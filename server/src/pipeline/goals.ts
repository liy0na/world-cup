import type { GoalEvent, Match } from '@wc/shared';
import type { DataProvider, MatchRef } from '../providers/provider';

const pairKey = (a?: string, b?: string) => [a, b].filter(Boolean).sort().join('|');
/** Give up re-fetching a finished match whose goal count never matches the score. */
const MAX_FINISHED_ATTEMPTS = 4;

/** Run `fn` over `items` with at most `limit` in flight at once. */
async function mapLimit<I>(items: I[], limit: number, fn: (item: I) => Promise<void>): Promise<void> {
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) await fn(items[cursor++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Tracks goal events (scorers) per fixture. Goals for finished matches never
 * change, so they are fetched once and cached; live matches are refreshed every
 * pass. Fetches run with bounded concurrency (so the cold start can backfill
 * every finished game without a burst), and the cache is seeded from the
 * persisted snapshot on restart.
 */
export class GoalTracker {
  private readonly byFixture = new Map<string, GoalEvent[]>();
  private readonly attempts = new Map<string, number>();

  /** Rehydrate from a previously persisted snapshot (so restarts keep scorers). */
  seed(matches: Match[]): void {
    for (const m of matches) if (m.goals && m.goals.length) this.byFixture.set(m.id, m.goals);
  }

  /**
   * Fetch goals for the fixtures that need them — live ones (refreshed every
   * pass) and finished ones whose cached goal count doesn't match the score
   * (backfill, or catch a goal missed while live) — newest first.
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
        if (have === undefined || (have < want && tries < MAX_FINISHED_ATTEMPTS)) {
          candidates.push({ match: m, ref, rank: 1 / (Date.parse(m.kickoff) || 1) }); // newest finished first
        }
      }
    }
    candidates.sort((a, b) => a.rank - b.rank);

    await mapLimit(candidates, concurrency, async ({ match, ref }) => {
      const observed = await provider.loadMatchGoals!(ref);
      // FIFA home/away -> our team ids (both are FIFA 3-letter codes = our ids).
      this.byFixture.set(
        match.id,
        observed.map((g) => ({
          teamId: (g.side === 'home' ? ref.homeCode : ref.awayCode) as string,
          player: g.player,
          minute: g.minute,
          kind: g.kind,
          order: g.order,
        })),
      );
      if (match.status === 'finished') this.attempts.set(match.id, (this.attempts.get(match.id) ?? 0) + 1);
    });
  }

  /** Attach cached goals to their fixtures. */
  attach(matches: Match[]): Match[] {
    if (this.byFixture.size === 0) return matches;
    return matches.map((m) => {
      const goals = this.byFixture.get(m.id);
      return goals && goals.length ? { ...m, goals } : m;
    });
  }
}
