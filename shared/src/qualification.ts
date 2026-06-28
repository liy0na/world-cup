import { computeGroupTable } from './standings';
import type {
  GroupLetter,
  Match,
  NeedOutcome,
  Qualification,
  StandingRow,
  Team,
  TeamStatus,
} from './types';

const QUALIFYING_THIRDS = 8;

type Outcome = 0 | 1 | 2; // 0 home win, 1 draw, 2 away win
interface Game {
  h: string;
  a: string;
  o: Outcome;
}

function applyOutcome(pts: Map<string, number>, h: string, a: string, o: Outcome): void {
  if (o === 0) pts.set(h, (pts.get(h) ?? 0) + 3);
  else if (o === 1) {
    pts.set(h, (pts.get(h) ?? 0) + 1);
    pts.set(a, (pts.get(a) ?? 0) + 1);
  } else pts.set(a, (pts.get(a) ?? 0) + 3);
}

function isRemaining(m: Match): boolean {
  return (m.status === 'scheduled' || m.status === 'live') && !!m.home.teamId && !!m.away.teamId;
}
function isFinished(m: Match): boolean {
  return (
    m.status === 'finished' &&
    typeof m.homeScore === 'number' &&
    typeof m.awayScore === 'number' &&
    !!m.home.teamId &&
    !!m.away.teamId
  );
}

interface GroupAnalysis {
  ids: string[];
  /** Finished games (fixed outcomes). */
  finished: Game[];
  /** Remaining games to enumerate. */
  remaining: { h: string; a: string }[];
  teamRanks: Map<string, { minRank: number; maxRank: number }>;
  /** base + 3 * (remaining games for the team) — the most points still attainable. */
  maxPoints: Map<string, number>;
  /** points already secured from finished matches (= worst-case final points). */
  basePoints: Map<string, number>;
  /** Smallest the 3rd-placed team's points can be forced to across all scenarios. */
  thirdGuaranteedPts: number;
  /** Largest the 3rd-placed team's points can possibly reach across all scenarios. */
  thirdPossibleMaxPts: number;
  /** True once every group game is played (the standings — incl. goals — are final). */
  complete: boolean;
  /** The locked 3rd-placed row; only meaningful (final goals) when `complete`. */
  thirdRow: StandingRow | null;
}

/**
 * Best/worst finishing rank of a team in one fully-decided scenario. Rivals are
 * ordered by points, then separated only by head-to-head points (criterion a,
 * margin-independent); margin-dependent tiebreakers stay open (best vs worst).
 */
function rankFor(teamId: string, ids: string[], pts: Map<string, number>, games: Game[]): { best: number; worst: number } {
  const p = pts.get(teamId)!;
  const strictMore = ids.filter((o) => pts.get(o)! > p).length;
  const tied = ids.filter((o) => pts.get(o)! === p);
  if (tied.length === 1) return { best: strictMore + 1, worst: strictMore + 1 };
  const h = new Map(tied.map((id) => [id, 0]));
  for (const g of games) awardH2H(h, g.h, g.a, g.o);
  const mine = h.get(teamId)!;
  const guaranteedAbove = tied.filter((o) => o !== teamId && h.get(o)! > mine).length;
  const notBelow = tied.filter((o) => h.get(o)! >= mine).length; // includes self
  return { best: strictMore + guaranteedAbove + 1, worst: strictMore + notBelow };
}

/** Award head-to-head points, but only for matches BETWEEN two teams in the tied set. */
function awardH2H(acc: Map<string, number>, h: string, a: string, o: Outcome): void {
  if (!acc.has(h) || !acc.has(a)) return; // only count matches among the tied teams
  if (o === 0) acc.set(h, acc.get(h)! + 3);
  else if (o === 1) {
    acc.set(h, acc.get(h)! + 1);
    acc.set(a, acc.get(a)! + 1);
  } else acc.set(a, acc.get(a)! + 3);
}

/**
 * Enumerate every win/draw/loss combination of a group's remaining matches and
 * record, for each team, the best and worst finishing position still possible.
 *
 * Certainty respects FIFA's 2026 order: a rival is only counted as GUARANTEED
 * above (or below) a team when head-to-head POINTS (criterion a) decide it —
 * that criterion depends only on win/draw/loss, not on margins. Margin-dependent
 * criteria (goal difference, goals) are treated as still-open, so a conclusion
 * holds for every possible scoreline. This is why a team that has already lost
 * head-to-head to the sides it would tie on points is correctly eliminated.
 */
function analyseGroup(groupTeams: Team[], group: GroupLetter, matches: Match[]): GroupAnalysis {
  const ids = groupTeams.map((t) => t.id);
  const base = new Map(ids.map((id) => [id, 0]));
  const remainingFor = new Map(ids.map((id) => [id, 0]));

  const groupMatches = matches.filter((m) => m.group === group);
  // Fixed (finished) games with their outcome, and the remaining games to enumerate.
  const finished: { h: string; a: string; o: Outcome }[] = [];
  const remaining: { h: string; a: string }[] = [];
  for (const m of groupMatches) {
    const h = m.home.teamId!;
    const a = m.away.teamId!;
    if (isFinished(m)) {
      if (!base.has(h) || !base.has(a)) continue;
      const o: Outcome = m.homeScore! > m.awayScore! ? 0 : m.homeScore! < m.awayScore! ? 2 : 1;
      finished.push({ h, a, o });
      if (o === 0) base.set(h, base.get(h)! + 3);
      else if (o === 2) base.set(a, base.get(a)! + 3);
      else {
        base.set(h, base.get(h)! + 1);
        base.set(a, base.get(a)! + 1);
      }
    } else if (isRemaining(m) && base.has(h) && base.has(a)) {
      remaining.push({ h, a });
    }
  }
  for (const r of remaining) {
    remainingFor.set(r.h, (remainingFor.get(r.h) ?? 0) + 1);
    remainingFor.set(r.a, (remainingFor.get(r.a) ?? 0) + 1);
  }

  const maxPoints = new Map(ids.map((id) => [id, base.get(id)! + 3 * (remainingFor.get(id) ?? 0)]));
  const teamRanks = new Map(ids.map((id) => [id, { minRank: ids.length, maxRank: 1 }]));
  let thirdGuaranteedPts = Number.POSITIVE_INFINITY;
  let thirdPossibleMaxPts = Number.NEGATIVE_INFINITY;

  const k = remaining.length;
  const scenarios = 3 ** k;
  for (let s = 0; s < scenarios; s++) {
    const games: Game[] = [...finished];
    const pts = new Map(base);
    remaining.forEach((m, i) => {
      const o = (Math.floor(s / 3 ** i) % 3) as Outcome;
      applyOutcome(pts, m.h, m.a, o);
      games.push({ h: m.h, a: m.a, o });
    });

    for (const id of ids) {
      const { best, worst } = rankFor(id, ids, pts, games);
      const r = teamRanks.get(id)!;
      if (best < r.minRank) r.minRank = best;
      if (worst > r.maxRank) r.maxRank = worst;
    }

    const sortedPts = ids.map((id) => pts.get(id)!).sort((x, y) => y - x);
    const thirdPts = sortedPts[2] ?? 0;
    thirdGuaranteedPts = Math.min(thirdGuaranteedPts, thirdPts);
    thirdPossibleMaxPts = Math.max(thirdPossibleMaxPts, thirdPts);
  }

  // Once every group game is played the table is final, so margin-dependent
  // tiebreakers (goal difference, goals — criteria d/e) are no longer "open".
  // The scenario logic above stays margin-independent (a team tied on points and
  // head-to-head points spans best..worst), which would leave a side that has
  // clinched 2nd purely on goal difference looking like it could still drop to
  // 3rd. Snap to the authoritative final standings instead.
  const complete = remaining.length === 0;
  const table = computeGroupTable(group, groupTeams, matches);
  if (complete) {
    for (const row of table.rows) {
      teamRanks.set(row.teamId, { minRank: row.rank, maxRank: row.rank });
    }
  }
  const thirdRow = table.rows.find((r) => r.rank === 3) ?? null;

  return {
    ids,
    finished,
    remaining,
    teamRanks,
    maxPoints,
    basePoints: base,
    thirdGuaranteedPts,
    thirdPossibleMaxPts,
    complete,
    thirdRow,
  };
}

/**
 * For a team with exactly one remaining group game, whether winning / drawing /
 * losing it lands the team in the top two — enumerating the group's other
 * remaining games for each of the team's three outcomes.
 */
function computeNeed(a: GroupAnalysis, teamId: string): Pick<TeamStatus, 'ifWin' | 'ifDraw' | 'ifLoss'> | undefined {
  const mine = a.remaining.filter((r) => r.h === teamId || r.a === teamId);
  if (mine.length !== 1) return undefined;
  const myMatch = mine[0]!;
  const others = a.remaining.filter((r) => r !== myMatch);
  const isHome = myMatch.h === teamId;
  const outcomeOf = (res: 'win' | 'draw' | 'loss'): Outcome =>
    res === 'draw' ? 1 : res === 'win' ? (isHome ? 0 : 2) : isHome ? 2 : 0;

  const evaluate = (res: 'win' | 'draw' | 'loss'): NeedOutcome => {
    let allGuaranteed = true;
    let anyPossible = false;
    for (let s = 0; s < 3 ** others.length; s++) {
      const pts = new Map(a.basePoints);
      const games: Game[] = [...a.finished, { h: myMatch.h, a: myMatch.a, o: outcomeOf(res) }];
      applyOutcome(pts, myMatch.h, myMatch.a, outcomeOf(res));
      others.forEach((m, i) => {
        const o = (Math.floor(s / 3 ** i) % 3) as Outcome;
        applyOutcome(pts, m.h, m.a, o);
        games.push({ h: m.h, a: m.a, o });
      });
      const { best, worst } = rankFor(teamId, a.ids, pts, games);
      if (best <= 2) anyPossible = true;
      if (worst > 2) allGuaranteed = false;
    }
    return allGuaranteed ? 'in' : anyPossible ? 'maybe' : 'out';
  };

  return { ifWin: evaluate('win'), ifDraw: evaluate('draw'), ifLoss: evaluate('loss') };
}

function fifaRank(teamsById: Map<string, Team>, teamId: string): number {
  return teamsById.get(teamId)?.fifaRanking ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Does third-placed row `a` rank strictly above `b`? Mirrors the cross-group
 * comparison in rankThirdPlacedTeams: points, goal difference, goals scored,
 * fair-play, then FIFA World Ranking.
 */
function thirdOutranks(a: StandingRow, b: StandingRow, teamsById: Map<string, Team>): boolean {
  if (a.points !== b.points) return a.points > b.points;
  if (a.gd !== b.gd) return a.gd > b.gd;
  if (a.gf !== b.gf) return a.gf > b.gf;
  if (a.fairPlay !== b.fairPlay) return a.fairPlay > b.fairPlay;
  return fifaRank(teamsById, a.teamId) < fifaRank(teamsById, b.teamId);
}

function classify(
  team: Team,
  rank: { minRank: number; maxRank: number },
  own: GroupAnalysis,
  others: GroupAnalysis[],
  teamsById: Map<string, Team>,
): TeamStatus {
  const status: TeamStatus = {
    teamId: team.id,
    group: team.group,
    outlook: 'alive',
    minRank: rank.minRank,
    maxRank: rank.maxRank,
  };
  if (rank.minRank === rank.maxRank) status.clinchedRank = rank.minRank;

  if (rank.maxRank === 1) return { ...status, outlook: 'won_group' };
  if (rank.maxRank <= 2) return { ...status, outlook: 'advanced' };

  if (rank.minRank >= 3) {
    // Cannot reach the top two. Locked last => out. Otherwise test the third-place lifeline.
    if (rank.minRank === 4) return { ...status, outlook: 'eliminated' };
    const myBest = own.maxPoints.get(team.id)!;
    const me = own.complete ? own.thirdRow : null;
    // Count groups whose third is GUARANTEED to finish above me. Strictly-more
    // points is always a guarantee. Once my group is over and I am its third, my
    // mark (points, GD, goals) is final, so another FINISHED group whose third
    // outranks me on the full third-place tiebreaker is a guarantee too — mirrors
    // the qualified_third branch below. Points alone would miss a rival level on
    // points but ahead on goal difference, leaving a doomed third stuck 'alive'.
    const guaranteedAhead = others.filter((o) => {
      if (o.thirdGuaranteedPts > myBest) return true;
      if (me && me.teamId === team.id && o.complete && o.thirdRow) return thirdOutranks(o.thirdRow, me, teamsById);
      return false;
    }).length;
    if (guaranteedAhead >= QUALIFYING_THIRDS) return { ...status, outlook: 'eliminated' };
  }

  // Guaranteed a best-8 third? Must always finish top-3, and across the other
  // groups at most 7 could ever field a third-placed team ranked above me.
  if (rank.maxRank <= 3) {
    const me = own.complete ? own.thirdRow : null;
    let couldBeatMe: number;
    if (me && me.teamId === team.id) {
      // My group is over, so my third-place mark (points, GD, goals) is final.
      // Count an already-finished group only when its third ACTUALLY outranks me
      // on the full third-place tiebreaker — a finished third level on points but
      // behind on goal difference / goals can never pass me. Groups still playing
      // stay conservative: any third that can still reach my points may beat me.
      couldBeatMe = others.filter((o) =>
        o.complete && o.thirdRow
          ? thirdOutranks(o.thirdRow, me, teamsById)
          : o.thirdPossibleMaxPts >= me.points,
      ).length;
    } else {
      const myWorst = own.basePoints.get(team.id)!;
      couldBeatMe = others.filter((o) => o.thirdPossibleMaxPts >= myWorst).length;
    }
    if (couldBeatMe <= QUALIFYING_THIRDS - 1) return { ...status, outlook: 'qualified_third' };
  }

  return status;
}

/**
 * Compute each team's mathematically-certain qualification outlook. Used both
 * for the live snapshot and for client-side "what-if" recomputation.
 */
export function computeQualification(teams: Team[], matches: Match[]): Qualification {
  const groups = [...new Set(teams.map((t) => t.group))].sort() as GroupLetter[];
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const analyses = new Map<GroupLetter, GroupAnalysis>();
  for (const g of groups) {
    analyses.set(g, analyseGroup(teams.filter((t) => t.group === g), g, matches));
  }

  const byTeam: Record<string, TeamStatus> = {};
  for (const g of groups) {
    const own = analyses.get(g)!;
    const others = [...analyses.entries()].filter(([k]) => k !== g).map(([, v]) => v);
    for (const team of teams.filter((t) => t.group === g)) {
      const rank = own.teamRanks.get(team.id);
      if (!rank) continue;
      byTeam[team.id] = { ...classify(team, rank, own, others, teamsById), ...computeNeed(own, team.id) };
    }
  }
  return { byTeam };
}
