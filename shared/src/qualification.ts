import type {
  GroupLetter,
  Match,
  Qualification,
  Team,
  TeamStatus,
} from './types';

const QUALIFYING_THIRDS = 8;

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
  teamRanks: Map<string, { minRank: number; maxRank: number }>;
  /** base + 3 * (remaining games for the team) — the most points still attainable. */
  maxPoints: Map<string, number>;
  /** points already secured from finished matches (= worst-case final points). */
  basePoints: Map<string, number>;
  /** Smallest the 3rd-placed team's points can be forced to across all scenarios. */
  thirdGuaranteedPts: number;
  /** Largest the 3rd-placed team's points can possibly reach across all scenarios. */
  thirdPossibleMaxPts: number;
}

type Outcome = 0 | 1 | 2; // 0 home win, 1 draw, 2 away win

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
    const outcomes = remaining.map((_, i) => (Math.floor(s / 3 ** i) % 3) as Outcome);
    const pts = new Map(base);
    remaining.forEach((m, i) => {
      const o = outcomes[i]!;
      if (o === 0) pts.set(m.h, pts.get(m.h)! + 3);
      else if (o === 1) {
        pts.set(m.h, pts.get(m.h)! + 1);
        pts.set(m.a, pts.get(m.a)! + 1);
      } else pts.set(m.a, pts.get(m.a)! + 3);
    });

    // Head-to-head points (criterion a) among each set of teams tied on points.
    const h2hPts = (tied: string[]): Map<string, number> => {
      const acc = new Map(tied.map((id) => [id, 0]));
      for (const g of finished) awardH2H(acc, g.h, g.a, g.o);
      remaining.forEach((m, i) => awardH2H(acc, m.h, m.a, outcomes[i]!));
      return acc;
    };

    for (const id of ids) {
      const p = pts.get(id)!;
      const tied = ids.filter((o) => pts.get(o)! === p);
      const strictMore = ids.filter((o) => pts.get(o)! > p).length;
      const h = tied.length > 1 ? h2hPts(tied) : new Map([[id, 0]]);
      const mine = h.get(id) ?? 0;
      // Guaranteed above: rivals that beat me on head-to-head points (margin-independent).
      const guaranteedAbove = tied.filter((o) => o !== id && (h.get(o) ?? 0) > mine).length;
      // Could be above-or-level: rivals I do NOT strictly beat head-to-head (plus myself).
      const notBelow = tied.filter((o) => (h.get(o) ?? 0) >= mine).length;

      const bestRank = strictMore + guaranteedAbove + 1;
      const worstRank = strictMore + notBelow;
      const r = teamRanks.get(id)!;
      if (bestRank < r.minRank) r.minRank = bestRank;
      if (worstRank > r.maxRank) r.maxRank = worstRank;
    }

    const sortedPts = ids.map((id) => pts.get(id)!).sort((x, y) => y - x);
    const thirdPts = sortedPts[2] ?? 0;
    thirdGuaranteedPts = Math.min(thirdGuaranteedPts, thirdPts);
    thirdPossibleMaxPts = Math.max(thirdPossibleMaxPts, thirdPts);
  }

  return { teamRanks, maxPoints, basePoints: base, thirdGuaranteedPts, thirdPossibleMaxPts };
}

function classify(
  team: Team,
  rank: { minRank: number; maxRank: number },
  own: GroupAnalysis,
  others: GroupAnalysis[],
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
    // Sound: count only groups whose third is GUARANTEED strictly above my best.
    const guaranteedAhead = others.filter((o) => o.thirdGuaranteedPts > myBest).length;
    if (guaranteedAhead >= QUALIFYING_THIRDS) return { ...status, outlook: 'eliminated' };
  }

  // Guaranteed a best-8 third? Must always finish top-3, and at my worst-case points
  // at most 7 other groups' thirds could possibly outrank me.
  if (rank.maxRank <= 3) {
    const myWorst = own.basePoints.get(team.id)!;
    const couldBeatMe = others.filter((o) => o.thirdPossibleMaxPts >= myWorst).length;
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
      byTeam[team.id] = classify(team, rank, own, others);
    }
  }
  return { byTeam };
}
