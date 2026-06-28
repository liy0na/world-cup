import { DEFAULT_RATING, ELO_RATINGS } from './data/eloRatings';
import { computeGroupTable } from './standings';
import { rankThirdPlacedTeams } from './thirds';
import type { GroupLetter, GroupTable, Match, Team } from './types';

/** A 0..1 random source; injectable so simulations can be made deterministic. */
export type Rng = () => number;

export interface TeamOdds {
  teamId: string;
  group: GroupLetter;
  /** P(reach the Round of 32) — top two OR a best-8 third place. */
  advance: number;
  /** P(finish 1st in the group). */
  winGroup: number;
  /** P(finish in the top two). */
  topTwo: number;
  /** P(advance specifically as one of the eight best third-placed teams). */
  bestThird: number;
}

export interface AdvancementOdds {
  byTeam: Record<string, TeamOdds>;
  /** Simulations run (1 when the group stage is already complete). */
  iterations: number;
}

/** Goal supremacy granted per 100 rating points of edge. */
const GOALS_PER_100 = 0.4;
/** Expected goals per team in a perfectly even match. */
const BASELINE_GOALS = 1.35;

function isFinished(m: Match): boolean {
  return (
    m.status === 'finished' &&
    typeof m.homeScore === 'number' &&
    typeof m.awayScore === 'number' &&
    !!m.home.teamId &&
    !!m.away.teamId
  );
}
function isOpen(m: Match): boolean {
  return (m.status === 'scheduled' || m.status === 'live') && !!m.home.teamId && !!m.away.teamId;
}

/** Sample a Poisson(lambda) count via Knuth's algorithm (lambda is small here). */
function poisson(lambda: number, rng: Rng): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

/** Sample a scoreline from two ratings: the stronger side gets more expected goals. */
export function sampleScore(rHome: number, rAway: number, rng: Rng): [number, number] {
  const sup = ((rHome - rAway) / 100) * GOALS_PER_100;
  const lambdaH = Math.max(0.18, BASELINE_GOALS + sup / 2);
  const lambdaA = Math.max(0.18, BASELINE_GOALS - sup / 2);
  return [poisson(lambdaH, rng), poisson(lambdaA, rng)];
}

/**
 * Estimate every team's chance of reaching the Round of 32 by Monte-Carlo: play
 * out all remaining group games many times (scorelines sampled from team-strength
 * ratings), resolve the full standings and the eight best third-placed teams each
 * run, and report the share of runs in which each team advances. When no group
 * games remain the outcome is deterministic, so a single run is used.
 */
export function simulateAdvancement(
  teams: Team[],
  matches: Match[],
  opts: { iterations?: number; ratings?: Record<string, number>; rng?: Rng } = {},
): AdvancementOdds {
  const ratings = opts.ratings ?? ELO_RATINGS;
  const rng = opts.rng ?? Math.random;
  const ratingOf = (id: string) => ratings[id] ?? DEFAULT_RATING;

  const groups = [...new Set(teams.map((t) => t.group))].sort() as GroupLetter[];
  const perGroup = groups.map((g) => ({
    g,
    groupTeams: teams.filter((t) => t.group === g),
    finished: matches.filter((m) => m.group === g && isFinished(m)),
    remaining: matches.filter((m) => m.group === g && isOpen(m)),
  }));

  const tally: Record<string, { advance: number; winGroup: number; topTwo: number; bestThird: number }> = {};
  for (const t of teams) tally[t.id] = { advance: 0, winGroup: 0, topTwo: 0, bestThird: 0 };

  const anyRemaining = perGroup.some((pg) => pg.remaining.length > 0);
  const iterations = anyRemaining ? Math.max(1, opts.iterations ?? 10000) : 1;

  for (let it = 0; it < iterations; it++) {
    const tables: GroupTable[] = perGroup.map((pg) => {
      const sims: Match[] = pg.remaining.map((m) => {
        const [hg, ag] = sampleScore(ratingOf(m.home.teamId!), ratingOf(m.away.teamId!), rng);
        return { ...m, status: 'finished' as const, homeScore: hg, awayScore: ag };
      });
      return computeGroupTable(pg.g, pg.groupTeams, [...pg.finished, ...sims]);
    });

    for (const table of tables) {
      const r1 = table.rows[0];
      const r2 = table.rows[1];
      if (r1) {
        tally[r1.teamId]!.winGroup++;
        tally[r1.teamId]!.topTwo++;
        tally[r1.teamId]!.advance++;
      }
      if (r2) {
        tally[r2.teamId]!.topTwo++;
        tally[r2.teamId]!.advance++;
      }
    }

    for (const row of rankThirdPlacedTeams(tables, teams).rows) {
      if (row.qualifies) {
        tally[row.teamId]!.bestThird++;
        tally[row.teamId]!.advance++;
      }
    }
  }

  const byTeam: Record<string, TeamOdds> = {};
  for (const t of teams) {
    const c = tally[t.id]!;
    byTeam[t.id] = {
      teamId: t.id,
      group: t.group,
      advance: c.advance / iterations,
      winGroup: c.winGroup / iterations,
      topTwo: c.topTwo / iterations,
      bestThird: c.bestThird / iterations,
    };
  }
  return { byTeam, iterations };
}
