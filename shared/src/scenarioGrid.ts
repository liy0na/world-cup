import { computeGroupTable, lowTiebreakTeams } from './standings';
import type { GroupLetter, Match, Team } from './types';

/** Which side a scoreline favours, from the perspective of a match's two teams. */
export type GridResult = 'team1' | 'draw' | 'team2';

export interface GridScoreline {
  /** Goals for team1 (the home side). */
  s1: number;
  /** Goals for team2 (the away side). */
  s2: number;
  result: GridResult;
}

export interface GridMatch {
  matchId: string;
  /** First team (home) — its goals vary as `s1`. */
  team1: string;
  /** Second team (away) — its goals vary as `s2`. */
  team2: string;
}

export interface GridCell {
  /** Final group rank (1..4) of every team id under this pair of scorelines. */
  ranks: Record<string, number>;
  /** Team ids whose finish here was decided by fair-play or FIFA ranking. */
  decidedByTiebreak: string[];
}

/**
 * A New-York-Times-style permutation grid for a group's final matchday: each
 * possible scoreline of one remaining match (columns) crossed with each scoreline
 * of the other (rows), recording where every team finishes. Only defined when the
 * group has exactly two open games covering all four teams (the last round).
 */
export interface ScenarioGrid {
  group: GroupLetter;
  /** Match mapped to columns. */
  col: GridMatch;
  /** Match mapped to rows. */
  row: GridMatch;
  /** Column scorelines, left→right = best for col.team1 → best for col.team2. */
  cols: GridScoreline[];
  /** Row scorelines, top→bottom = best for row.team1 → best for row.team2. */
  rows: GridScoreline[];
  /** cells[rowIndex][colIndex]. */
  cells: GridCell[][];
  /** Highest goals-per-team enumerated on each axis. */
  maxGoals: number;
}

const DEFAULT_MAX_GOALS = 4;

/** A group game still to be played (or in progress) with both teams known. */
function isOpen(m: Match): boolean {
  return (m.status === 'scheduled' || m.status === 'live') && !!m.home.teamId && !!m.away.teamId;
}

/**
 * Ordered scorelines for one match. Left/top (best for team1) → right/bottom
 * (best for team2): team1's biggest wins first (4-0, 4-1, 3-0, …, 1-0), then
 * draws (0-0 … 4-4), then team2's narrowest → biggest wins. This ordering makes
 * the grid's colour regions read as smooth bands.
 */
function scorelines(maxGoals: number): GridScoreline[] {
  const team1Wins: GridScoreline[] = [];
  const draws: GridScoreline[] = [];
  const team2Wins: GridScoreline[] = [];
  for (let s1 = 0; s1 <= maxGoals; s1++) {
    for (let s2 = 0; s2 <= maxGoals; s2++) {
      if (s1 > s2) team1Wins.push({ s1, s2, result: 'team1' });
      else if (s1 === s2) draws.push({ s1, s2, result: 'draw' });
      else team2Wins.push({ s1, s2, result: 'team2' });
    }
  }
  // team1 wins: biggest margin first, then more goals.
  team1Wins.sort((a, b) => b.s1 - b.s2 - (a.s1 - a.s2) || b.s1 - a.s1);
  // draws: fewest goals first.
  draws.sort((a, b) => a.s1 - b.s1);
  // team2 wins: narrowest margin first, then fewer goals.
  team2Wins.sort((a, b) => a.s2 - a.s1 - (b.s2 - b.s1) || a.s2 - b.s2);
  return [...team1Wins, ...draws, ...team2Wins];
}

/**
 * Build the final-matchday permutation grid for a group, or undefined when the
 * group is not on its last round (exactly two open games spanning all four
 * teams). Every cell is the authoritative final table for that pair of
 * scorelines, so margin-dependent tiebreakers (goal difference, goals, fair-play,
 * FIFA ranking) are fully resolved — unlike the margin-independent qualification
 * outlook.
 */
export function computeScenarioGrid(
  group: GroupLetter,
  teams: Team[],
  matches: Match[],
  maxGoals: number = DEFAULT_MAX_GOALS,
): ScenarioGrid | undefined {
  const groupTeams = teams.filter((t) => t.group === group);
  if (groupTeams.length !== 4) return undefined;

  const groupMatches = matches.filter((m) => m.group === group);
  const open = groupMatches.filter(isOpen);
  if (open.length !== 2) return undefined;

  // A clean final matchday: the two open games involve all four distinct teams.
  const involved = new Set<string>();
  for (const m of open) {
    involved.add(m.home.teamId!);
    involved.add(m.away.teamId!);
  }
  if (involved.size !== 4) return undefined;

  // Stable axis assignment: earlier kickoff (then match number, then id) → columns.
  const sorted = [...open].sort(
    (a, b) =>
      Date.parse(a.kickoff) - Date.parse(b.kickoff) ||
      (a.matchNumber ?? 0) - (b.matchNumber ?? 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const colM = sorted[0]!;
  const rowM = sorted[1]!;
  const col: GridMatch = { matchId: colM.id, team1: colM.home.teamId!, team2: colM.away.teamId! };
  const row: GridMatch = { matchId: rowM.id, team1: rowM.home.teamId!, team2: rowM.away.teamId! };

  const others = groupMatches.filter((m) => m.id !== colM.id && m.id !== rowM.id);
  const cols = scorelines(maxGoals);
  const rows = scorelines(maxGoals);

  const synth = (m: Match, homeScore: number, awayScore: number): Match => ({
    ...m,
    status: 'finished',
    homeScore,
    awayScore,
  });

  const cells: GridCell[][] = rows.map((rs) =>
    cols.map((cs) => {
      const sim = [...others, synth(colM, cs.s1, cs.s2), synth(rowM, rs.s1, rs.s2)];
      const table = computeGroupTable(group, groupTeams, sim);
      const ranks: Record<string, number> = {};
      for (const r of table.rows) ranks[r.teamId] = r.rank;
      return { ranks, decidedByTiebreak: [...lowTiebreakTeams(table, sim)] };
    }),
  );

  return { group, col, row, cols, rows, cells, maxGoals };
}
