import type { AssistEvent, CardTally, GoalEvent, Match } from '@wc/shared';
import type { DataProvider, MatchRef } from '../providers/provider';

const pairKey = (a?: string, b?: string) => [a, b].filter(Boolean).sort().join('|');
/** Give up re-fetching a finished match whose goal count never matches the score. */
const MAX_FINISHED_ATTEMPTS = 4;

interface Cards {
  home: CardTally;
  away: CardTally;
}

/** Run `fn` over `items` with at most `limit` in flight at once. */
async function mapLimit<I>(items: I[], limit: number, fn: (item: I) => Promise<void>): Promise<void> {
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) await fn(items[cursor++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Enriches fixtures with the per-match data we mine from the FIFA detail +
 * timeline endpoints: goals (scorers), assists, lineups (games-played) and
 * cards. Finished matches never change, so they are fetched once and cached;
 * live matches refresh every pass. Fetches run with bounded concurrency (so the
 * cold start can backfill the whole tournament without a burst) and the cache is
 * seeded from the persisted snapshot on restart.
 */
export class GoalTracker {
  private readonly byFixture = new Map<string, GoalEvent[]>();
  private readonly assistsByFixture = new Map<string, AssistEvent[]>();
  private readonly lineupByFixture = new Map<string, string[]>();
  private readonly cardsByFixture = new Map<string, Cards>();
  private readonly attempts = new Map<string, number>();

  /** Rehydrate from a previously persisted snapshot (so restarts keep the enrichment). */
  seed(matches: Match[]): void {
    for (const m of matches) {
      if (m.goals && m.goals.length) this.byFixture.set(m.id, m.goals);
      if (m.assists && m.assists.length) this.assistsByFixture.set(m.id, m.assists);
      if (m.lineup && m.lineup.length) this.lineupByFixture.set(m.id, m.lineup);
      if (m.homeCards || m.awayCards) {
        const zero: CardTally = { yellow: 0, doubleYellow: 0, red: 0 };
        this.cardsByFixture.set(m.id, { home: m.homeCards ?? zero, away: m.awayCards ?? zero });
      }
    }
  }

  /**
   * Fetch enrichment for the fixtures that need it — live ones (refreshed every
   * pass) and finished ones still missing goals/lineup — newest first.
   */
  async update(matches: Match[], refs: MatchRef[], provider: DataProvider, concurrency: number): Promise<void> {
    if (!provider.loadMatchGoals) return;
    const refByPair = new Map<string, MatchRef>();
    for (const r of refs) if (r.homeCode && r.awayCode) refByPair.set(pairKey(r.homeCode, r.awayCode), r);

    const candidates: { match: Match; ref: MatchRef; rank: number }[] = [];
    for (const m of matches) {
      if (!m.home.teamId || !m.away.teamId) continue;
      const ref = refByPair.get(pairKey(m.home.teamId, m.away.teamId));
      if (!ref) continue;
      if (m.status === 'live') {
        candidates.push({ match: m, ref, rank: 0 }); // always refresh live
      } else if (m.status === 'finished') {
        const have = this.byFixture.get(m.id)?.length;
        const want = (m.homeScore ?? 0) + (m.awayScore ?? 0);
        const tries = this.attempts.get(m.id) ?? 0;
        // Fetch if any enrichment is missing: incomplete goals, or no lineup /
        // assists / cards yet (e.g. a snapshot seeded before those existed).
        const needs =
          have === undefined ||
          have < want ||
          !this.lineupByFixture.has(m.id) ||
          !this.assistsByFixture.has(m.id) ||
          !this.cardsByFixture.has(m.id);
        if (needs && tries < MAX_FINISHED_ATTEMPTS) {
          candidates.push({ match: m, ref, rank: 1 / (Date.parse(m.kickoff) || 1) }); // newest finished first
        }
      }
    }
    candidates.sort((a, b) => a.rank - b.rank);

    await mapLimit(candidates, concurrency, async ({ match, ref }) => {
      const { goals, lineup, assists, homeCards, awayCards } = await provider.loadMatchGoals!(ref);
      // FIFA home/away -> our team ids (both are FIFA 3-letter codes = our ids).
      const teamFor = (side: 'home' | 'away') => (side === 'home' ? ref.homeCode : ref.awayCode) as string;
      this.byFixture.set(
        match.id,
        goals.map((g) => ({
          teamId: teamFor(g.side),
          player: g.player,
          playerId: g.playerId,
          minute: g.minute,
          kind: g.kind,
          order: g.order,
        })),
      );
      this.assistsByFixture.set(
        match.id,
        assists.map((a) => ({ teamId: teamFor(a.side), player: a.player, playerId: a.playerId, minute: a.minute })),
      );
      this.lineupByFixture.set(match.id, lineup);
      // Orient FIFA home/away cards onto the fixture's home/away.
      const sameOrientation = match.home.teamId === ref.homeCode;
      this.cardsByFixture.set(match.id, {
        home: sameOrientation ? homeCards : awayCards,
        away: sameOrientation ? awayCards : homeCards,
      });
      if (match.status === 'finished') this.attempts.set(match.id, (this.attempts.get(match.id) ?? 0) + 1);
    });
  }

  /** Attach all cached enrichment (goals, assists, lineups, cards) to their fixtures. */
  attach(matches: Match[]): Match[] {
    if (this.byFixture.size === 0 && this.lineupByFixture.size === 0 && this.cardsByFixture.size === 0) return matches;
    return matches.map((m) => {
      const goals = this.byFixture.get(m.id);
      const assists = this.assistsByFixture.get(m.id);
      const lineup = this.lineupByFixture.get(m.id);
      const cards = this.cardsByFixture.get(m.id);
      if (!goals?.length && !assists?.length && !lineup?.length && !cards) return m;
      return {
        ...m,
        ...(goals?.length ? { goals } : {}),
        ...(assists?.length ? { assists } : {}),
        ...(lineup?.length ? { lineup } : {}),
        ...(cards ? { homeCards: cards.home, awayCards: cards.away } : {}),
      };
    });
  }
}
