import type {
  CardTally,
  GroupLetter,
  GroupTable,
  Match,
  StandingRow,
  Team,
} from './types';

/**
 * FIFA fair-play (disciplinary) points. Less negative = better conduct.
 * Approximates FIFA's table from an aggregate card tally:
 *   single yellow -1, second-yellow send-off -3, direct red -4.
 * (Free data sources rarely expose cards, so this is usually 0 and we fall
 * through to the FIFA World Ranking tiebreaker.)
 */
export function fairPlayPoints(cards?: CardTally): number {
  if (!cards) return 0;
  return -(cards.yellow * 1 + cards.doubleYellow * 3 + cards.red * 4);
}

/** A match counts toward the live/provisional table once it is live or finished. */
function counts(m: Match): boolean {
  return (
    (m.status === 'finished' || m.status === 'live') &&
    typeof m.homeScore === 'number' &&
    typeof m.awayScore === 'number' &&
    !!m.home.teamId &&
    !!m.away.teamId
  );
}

function emptyRow(teamId: string): StandingRow {
  return {
    teamId,
    rank: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    fairPlay: 0,
  };
}

function applyResult(row: StandingRow, gf: number, ga: number, cards?: CardTally): void {
  row.played += 1;
  row.gf += gf;
  row.ga += ga;
  row.fairPlay += fairPlayPoints(cards);
  if (gf > ga) {
    row.won += 1;
    row.points += 3;
  } else if (gf === ga) {
    row.drawn += 1;
    row.points += 1;
  } else {
    row.lost += 1;
  }
  row.gd = row.gf - row.ga;
}

/** Overall comparison: points, then goal difference, then goals scored. */
function compareOverall(a: StandingRow, b: StandingRow): number {
  return b.points - a.points || b.gd - a.gd || b.gf - a.gf;
}

/**
 * Head-to-head mini-table among a set of tied teams: only their matches against
 * each other count. Returns h2h points / gd / gf per team id.
 */
function headToHead(
  tiedTeamIds: Set<string>,
  matches: Match[],
): Map<string, { pts: number; gd: number; gf: number }> {
  const acc = new Map<string, { pts: number; gd: number; gf: number }>();
  for (const id of tiedTeamIds) acc.set(id, { pts: 0, gd: 0, gf: 0 });
  for (const m of matches) {
    if (!counts(m)) continue;
    const h = m.home.teamId!;
    const a = m.away.teamId!;
    if (!tiedTeamIds.has(h) || !tiedTeamIds.has(a)) continue;
    const hs = m.homeScore!;
    const as = m.awayScore!;
    const hAcc = acc.get(h)!;
    const aAcc = acc.get(a)!;
    hAcc.gf += hs;
    hAcc.gd += hs - as;
    aAcc.gf += as;
    aAcc.gd += as - hs;
    if (hs > as) hAcc.pts += 3;
    else if (hs === as) {
      hAcc.pts += 1;
      aAcc.pts += 1;
    } else aAcc.pts += 3;
  }
  return acc;
}

/** Build clusters of consecutive rows that are equal under `equal`. */
function cluster(rows: StandingRow[], equal: (a: StandingRow, b: StandingRow) => boolean): StandingRow[][] {
  const out: StandingRow[][] = [];
  let cur: StandingRow[] = [];
  for (const row of rows) {
    if (cur.length === 0 || equal(cur[cur.length - 1]!, row)) {
      cur.push(row);
    } else {
      out.push(cur);
      cur = [row];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Resolve order within a set of teams tied on overall points/GD/goals, applying
 * (in order) head-to-head points/GD/goals, then fair-play, then FIFA ranking.
 */
function breakTie(tied: StandingRow[], matches: Match[], teamsById: Map<string, Team>): StandingRow[] {
  if (tied.length < 2) return tied;
  const ids = new Set(tied.map((r) => r.teamId));
  const h2h = headToHead(ids, matches);
  const sorted = [...tied].sort((a, b) => {
    const ha = h2h.get(a.teamId)!;
    const hb = h2h.get(b.teamId)!;
    return (
      hb.pts - ha.pts ||
      hb.gd - ha.gd ||
      hb.gf - ha.gf ||
      b.fairPlay - a.fairPlay ||
      fifaRank(teamsById, a.teamId) - fifaRank(teamsById, b.teamId)
    );
  });
  return sorted;
}

function fifaRank(teamsById: Map<string, Team>, teamId: string): number {
  return teamsById.get(teamId)?.fifaRanking ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Compute a group's standings "as it stands", including live matches at their
 * current score. Tiebreakers follow FIFA's published 2026 order:
 *   1) points  2) goal difference  3) goals scored
 *   4) head-to-head points  5) h2h goal difference  6) h2h goals
 *   7) fair-play points  8) FIFA World Ranking.
 *
 * Note: where teams remain tied after head-to-head, FIFA re-applies the whole
 * sequence to the still-tied subgroup. We apply head-to-head once to the
 * maximal overall-tied cluster (correct for the common 2- and 3-way ties) and
 * then fall through to fair-play / FIFA ranking.
 */
export function computeGroupTable(
  group: GroupLetter,
  teams: Team[],
  matches: Match[],
): GroupTable {
  const groupTeams = teams.filter((t) => t.group === group);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const rows = new Map<string, StandingRow>();
  for (const t of groupTeams) rows.set(t.id, emptyRow(t.id));

  for (const m of matches) {
    if (m.group !== group || !counts(m)) continue;
    const home = rows.get(m.home.teamId!);
    const away = rows.get(m.away.teamId!);
    if (!home || !away) continue;
    applyResult(home, m.homeScore!, m.awayScore!, m.homeCards);
    applyResult(away, m.awayScore!, m.homeScore!, m.awayCards);
  }

  // 1) overall sort, then 2) break ties cluster by cluster.
  const sorted = [...rows.values()].sort(compareOverall);
  const overallEqual = (a: StandingRow, b: StandingRow) => compareOverall(a, b) === 0;
  const ordered: StandingRow[] = [];
  for (const c of cluster(sorted, overallEqual)) {
    ordered.push(...breakTie(c, matches, teamsById));
  }

  ordered.forEach((row, i) => (row.rank = i + 1));
  return { group, rows: ordered };
}

/** Convenience: compute all 12 group tables. */
export function computeAllGroupTables(teams: Team[], matches: Match[]): GroupTable[] {
  const groups = [...new Set(teams.map((t) => t.group))].sort();
  return groups.map((g) => computeGroupTable(g, teams, matches));
}
