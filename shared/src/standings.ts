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

/**
 * Fallback comparison once head-to-head can't separate teams: overall goal
 * difference, then overall goals scored, then fair play, then FIFA ranking
 * (FIFA 2026 criteria d, e, f, g).
 */
function compareFallback(a: StandingRow, b: StandingRow, teamsById: Map<string, Team>): number {
  return (
    b.gd - a.gd ||
    b.gf - a.gf ||
    b.fairPlay - a.fairPlay ||
    fifaRank(teamsById, a.teamId) - fifaRank(teamsById, b.teamId)
  );
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
 * Resolve the order of teams tied on points using FIFA's 2026 procedure:
 * apply head-to-head points/GD/goals (criteria a–c) among the tied teams; for
 * any subgroup still level, REAPPLY a–c to just those teams; only when
 * head-to-head cannot separate teams fall back to overall GD/goals/fair-play/
 * FIFA ranking (criteria d–g).
 */
function resolveTie(tied: StandingRow[], matches: Match[], teamsById: Map<string, Team>): StandingRow[] {
  if (tied.length < 2) return tied;

  const h2h = headToHead(new Set(tied.map((r) => r.teamId)), matches);
  const h = (id: string) => h2h.get(id)!;
  const h2hEqual = (a: StandingRow, b: StandingRow) =>
    h(a.teamId).pts === h(b.teamId).pts &&
    h(a.teamId).gd === h(b.teamId).gd &&
    h(a.teamId).gf === h(b.teamId).gf;

  const sorted = [...tied].sort(
    (a, b) => h(b.teamId).pts - h(a.teamId).pts || h(b.teamId).gd - h(a.teamId).gd || h(b.teamId).gf - h(a.teamId).gf,
  );
  const subClusters = cluster(sorted, h2hEqual);

  // Head-to-head separated everyone.
  if (subClusters.length === tied.length) return sorted;
  // Head-to-head separated no-one — fall back to overall criteria.
  if (subClusters.length === 1) return [...tied].sort((a, b) => compareFallback(a, b, teamsById));
  // Partial: reapply a–c to each still-level subgroup, then fall back if needed.
  return subClusters.flatMap((sub) => resolveTie(sub, matches, teamsById));
}

function fifaRank(teamsById: Map<string, Team>, teamId: string): number {
  return teamsById.get(teamId)?.fifaRanking ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Compute a group's standings "as it stands", including live matches at their
 * current score. Tiebreakers follow FIFA's published 2026 order: teams level on
 * points are separated FIRST by head-to-head (points, then GD, then goals in
 * the matches between them — criteria a–c, reapplied to any still-level
 * subgroup), and only then by overall goal difference, overall goals, fair-play
 * and FIFA World Ranking (criteria d–g). Head-to-head outranks overall GD.
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

  // 1) sort by points, then 2) resolve each points-tie via head-to-head first.
  const sorted = [...rows.values()].sort((a, b) => b.points - a.points);
  const ordered: StandingRow[] = [];
  for (const c of cluster(sorted, (a, b) => a.points === b.points)) {
    ordered.push(...resolveTie(c, matches, teamsById));
  }

  ordered.forEach((row, i) => (row.rank = i + 1));
  return { group, rows: ordered };
}

/** Convenience: compute all 12 group tables. */
export function computeAllGroupTables(teams: Team[], matches: Match[]): GroupTable[] {
  const groups = [...new Set(teams.map((t) => t.group))].sort();
  return groups.map((g) => computeGroupTable(g, teams, matches));
}

/**
 * Team ids whose final position was separated from the team immediately above or
 * below ONLY by fair-play points or FIFA ranking (FIFA 2026 criteria f/g) — i.e.
 * the two were level on points, head-to-head (a–c) AND overall goal difference /
 * goals (d–e). Used to flag "decided by discipline / ranking" cells in the
 * scenario grid. `table` must have been produced by computeGroupTable(matches).
 */
export function lowTiebreakTeams(table: GroupTable, matches: Match[]): Set<string> {
  const flagged = new Set<string>();
  const rows = table.rows;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    if (a.points !== b.points) continue; // separated by points (criterion before a)
    // Within everyone level on these points, did head-to-head (a–c) separate them?
    const cluster = rows.filter((r) => r.points === a.points).map((r) => r.teamId);
    const h2h = headToHead(new Set(cluster), matches);
    const ha = h2h.get(a.teamId)!;
    const hb = h2h.get(b.teamId)!;
    if (ha.pts !== hb.pts || ha.gd !== hb.gd || ha.gf !== hb.gf) continue; // h2h separated
    if (a.gd !== b.gd || a.gf !== b.gf) continue; // overall GD / goals separated
    flagged.add(a.teamId);
    flagged.add(b.teamId);
  }
  return flagged;
}
