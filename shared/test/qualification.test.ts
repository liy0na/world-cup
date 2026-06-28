import { describe, expect, it } from 'vitest';
import { computeQualification } from '../src/qualification';
import type { GroupLetter, Match, Team } from '../src/types';
import { result, team } from './helpers';

/** A finished 4-team group whose 3rd-placed team ends on 4 points (sorted 5,4,4,3). */
function finishedGroupThird4(L: GroupLetter): { teams: Team[]; matches: Match[] } {
  const [a, b, c, d] = [`${L}1`, `${L}2`, `${L}3`, `${L}4`];
  return {
    teams: [team(a, L), team(b, L), team(c, L), team(d, L)],
    matches: [
      result(L, a, b, 1, 0),
      result(L, a, c, 0, 0),
      result(L, a, d, 0, 0),
      result(L, b, c, 1, 0),
      result(L, d, b, 1, 0),
      result(L, c, d, 1, 0),
    ],
  };
}

describe('computeQualification — within-group clinching', () => {
  it('flags a team that has clinched 1st as won_group', () => {
    const teams = [team('a1', 'A'), team('a2', 'A'), team('a3', 'A'), team('a4', 'A')];
    const matches = [
      result('A', 'a1', 'a2', 1, 0),
      result('A', 'a1', 'a3', 1, 0),
      result('A', 'a1', 'a4', 1, 0), // a1 = 9, done
      result('A', 'a2', 'a3', 0, 0, { status: 'scheduled' }),
      result('A', 'a2', 'a4', 0, 0, { status: 'scheduled' }),
      result('A', 'a3', 'a4', 0, 0, { status: 'scheduled' }),
    ];
    const q = computeQualification(teams, matches);
    expect(q.byTeam['a1']!.outlook).toBe('won_group');
    expect(q.byTeam['a1']!.clinchedRank).toBe(1);
    expect(q.byTeam['a2']!.outlook).toBe('alive');
  });

  it('flags a team that has clinched top-2 (but not 1st) as advanced', () => {
    const teams = [team('a1', 'A'), team('a2', 'A'), team('a3', 'A'), team('a4', 'A')];
    const matches = [
      result('A', 'a1', 'a3', 1, 0),
      result('A', 'a1', 'a4', 1, 0), // a1 = 6, one game left (vs a2)
      result('A', 'a2', 'a3', 1, 0),
      result('A', 'a2', 'a4', 1, 0), // a2 = 6, one game left (vs a1)
      result('A', 'a3', 'a4', 1, 0), // a3 = 3 done, a4 = 0 done
      result('A', 'a1', 'a2', 0, 0, { status: 'scheduled' }),
    ];
    const q = computeQualification(teams, matches);
    expect(q.byTeam['a1']!.outlook).toBe('advanced');
    expect(q.byTeam['a2']!.outlook).toBe('advanced');
  });

  it('flags a 2nd-place team in a FINISHED group as advanced when only goal difference separates it from 3rd', () => {
    // Mirrors the real Group B (Switzerland/Canada/Bosnia/Qatar): all 6 games played.
    // CAN and BIH both finish on 4 pts and DREW their head-to-head 1-1, so head-to-head
    // points (criterion a) cannot separate them — only overall goal difference does
    // (CAN +5 vs BIH -1). Since the group is over, that tiebreak is final: CAN is 2nd
    // (advanced/through), BIH is 3rd. CAN must NOT be left in the best-third lifeline.
    const teams = [team('SUI', 'B'), team('CAN', 'B'), team('BIH', 'B'), team('QAT', 'B')];
    const matches = [
      result('B', 'CAN', 'BIH', 1, 1),
      result('B', 'QAT', 'SUI', 1, 1),
      result('B', 'SUI', 'BIH', 4, 1),
      result('B', 'CAN', 'QAT', 6, 0),
      result('B', 'SUI', 'CAN', 2, 1),
      result('B', 'BIH', 'QAT', 3, 1),
    ];
    const q = computeQualification(teams, matches);
    expect(q.byTeam['CAN']!.outlook).toBe('advanced');
    expect(q.byTeam['CAN']!.clinchedRank).toBe(2);
    expect(q.byTeam['BIH']!.clinchedRank).toBe(3);
    expect(q.byTeam['BIH']!.outlook).not.toBe('advanced');
  });

  it('eliminates a team via head-to-head even though it could win its last game (2026 rule)', () => {
    // STR is strong (6 pts, plays T last). X and Y are on 3 and have both BEATEN T.
    // T (0 pts) can beat STR to reach 3, but when it ties X or Y it loses the head-to-head,
    // so head-to-head (criterion a, before goal difference) keeps T 4th in every scenario.
    const teams = [team('STR', 'C'), team('XX', 'C'), team('YY', 'C'), team('TT', 'C')];
    const matches = [
      result('C', 'XX', 'TT', 1, 0), // X beat T
      result('C', 'YY', 'TT', 1, 0), // Y beat T -> T has lost H2H to both
      result('C', 'STR', 'XX', 1, 0),
      result('C', 'STR', 'YY', 1, 0), // STR = 6
      result('C', 'STR', 'TT', 0, 0, { status: 'scheduled' }), // T's last game (max 3 pts)
      result('C', 'XX', 'YY', 0, 0, { status: 'scheduled' }),
    ];
    const q = computeQualification(teams, matches);
    expect(q.byTeam['TT']!.outlook).toBe('eliminated');
    expect(q.byTeam['TT']!.maxRank).toBe(4);
    expect(q.byTeam['STR']!.outlook).toBe('won_group'); // STR wins H2H against any team it ties
  });

  it('computes what an alive team needs in its last game', () => {
    // Group of 4, each has played 2, one game left (a1 v a2, a3 v a4).
    // a1: 4 pts (W,D), a2: 4 pts, a3: 1, a4: 1. a1 & a2 meet; a3/a4 can reach at most 4.
    const teams = [team('a1', 'A'), team('a2', 'A'), team('a3', 'A'), team('a4', 'A')];
    const matches = [
      result('A', 'a1', 'a3', 1, 0),
      result('A', 'a1', 'a4', 1, 1), // a1: 3+1 = 4
      result('A', 'a2', 'a3', 1, 1),
      result('A', 'a2', 'a4', 1, 0), // a2: 1+3 = 4
      result('A', 'a3', 'a4', 0, 0), // a3: 0+0+1=1 done, a4: 1+0+0=1 done
      result('A', 'a1', 'a2', 0, 0, { status: 'scheduled' }), // the decider
    ];
    const q = computeQualification(teams, matches);
    // a3 and a4 are done on 1 pt and out; a1 & a2 (4 pts) settle top 2 between them.
    // Whatever a1 does in its last game it is already top 2 (a3/a4 maxed at 1) -> not 'alive'.
    expect(q.byTeam['a1']!.outlook).toBe('advanced');
    // With both finishing well clear, a win/draw/loss all keep a1 in the top two.
    expect(q.byTeam['a1']!.ifWin).toBe('in');
    expect(q.byTeam['a1']!.ifDraw).toBe('in');
    expect(q.byTeam['a1']!.ifLoss).toBe('in');
  });

  it('flags a team locked into last place as eliminated', () => {
    const teams = [team('z1', 'B'), team('z2', 'B'), team('z3', 'B'), team('z4', 'B')];
    const matches = [
      result('B', 'z1', 'z4', 1, 0),
      result('B', 'z2', 'z4', 1, 0),
      result('B', 'z3', 'z4', 1, 0), // z4 lost all 3, done, 0 pts
      result('B', 'z1', 'z2', 0, 0, { status: 'scheduled' }),
      result('B', 'z1', 'z3', 0, 0, { status: 'scheduled' }),
      result('B', 'z2', 'z3', 0, 0, { status: 'scheduled' }),
    ];
    const q = computeQualification(teams, matches);
    expect(q.byTeam['z4']!.outlook).toBe('eliminated');
    expect(q.byTeam['z4']!.clinchedRank).toBe(4);
  });
});

describe('computeQualification — best-third elimination across groups', () => {
  // Target team A4: cannot reach the top 2, best possible total = 3 points, but CAN finish 3rd
  // (it can still beat A3 head-to-head), so only the cross-group third-place bound can eliminate it.
  const targetTeams = [team('A1', 'A'), team('A2', 'A'), team('A3', 'A'), team('A4', 'A')];
  const targetMatches: Match[] = [
    result('A', 'A1', 'A3', 1, 0),
    result('A', 'A1', 'A4', 1, 0), // A1 = 6 (remaining vs A2)
    result('A', 'A2', 'A3', 1, 0),
    result('A', 'A2', 'A4', 1, 0), // A2 = 6 (remaining vs A1)
    result('A', 'A1', 'A2', 0, 0, { status: 'scheduled' }), // top game open
    result('A', 'A3', 'A4', 0, 0, { status: 'scheduled' }), // A4 can win this to finish 3rd on 3 pts
  ];

  function withOtherGroups(letters: GroupLetter[]) {
    const teams = [...targetTeams];
    const matches = [...targetMatches];
    for (const L of letters) {
      const g = finishedGroupThird4(L);
      teams.push(...g.teams);
      matches.push(...g.matches);
    }
    return { teams, matches };
  }

  it('eliminates the team when 8 other groups guarantee a stronger third', () => {
    const { teams, matches } = withOtherGroups(['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
    const q = computeQualification(teams, matches);
    expect(q.byTeam['A4']!.minRank).toBeGreaterThanOrEqual(3); // can't reach top 2
    expect(q.byTeam['A4']!.outlook).toBe('eliminated');
  });

  it('keeps the team alive when only 7 other groups outrank its best', () => {
    const { teams, matches } = withOtherGroups(['B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const q = computeQualification(teams, matches);
    expect(q.byTeam['A4']!.outlook).not.toBe('eliminated');
  });
});

describe('computeQualification — best-third guarantee respects goal tiebreakers', () => {
  // A FINISHED 4-team group whose 3rd-placed team (L3) ends on 3 points with a
  // chosen goal difference. L1 wins all, L2 wins two, L3 beats only L4.
  function finishedThird3(L: GroupLetter, l3WinBy: number): { teams: Team[]; matches: Match[] } {
    const [a, b, c, d] = [`${L}1`, `${L}2`, `${L}3`, `${L}4`];
    return {
      teams: [team(a, L), team(b, L), team(c, L), team(d, L)],
      matches: [
        result(L, a, b, 1, 0),
        result(L, a, c, 1, 0), // L3 loses to L1
        result(L, a, d, 1, 0),
        result(L, b, c, 1, 0), // L3 loses to L2
        result(L, b, d, 1, 0),
        result(L, c, d, l3WinBy, 0), // L3's only win — controls its goal difference
      ],
    };
  }
  // An all-scheduled group: its eventual 3rd CAN still reach 3+ points, so it
  // stays a conservative "possible beater".
  function unfinishedGroup(L: GroupLetter): { teams: Team[]; matches: Match[] } {
    const ids = [`${L}1`, `${L}2`, `${L}3`, `${L}4`];
    const ms: Match[] = [];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        ms.push(result(L, ids[i]!, ids[j]!, 0, 0, { status: 'scheduled' }));
    return { teams: ids.map((id) => team(id, L)), matches: ms };
  }

  it('flags a finished 3rd as qualified even when other finished 3rds are level on points but behind on goals', () => {
    // Target A3: finished 3rd on 3 pts with a STRONG goal difference.
    const target = finishedThird3('A', 6); // L3 wins 6-0 -> GF6 GA2 GD+4
    // 4 finished groups with a 3rd on 4 pts -> genuine beaters.
    const fourPt = (['B', 'C', 'D', 'E'] as GroupLetter[]).map((L) => finishedGroupThird4(L));
    // 3 finished groups whose 3rd is level on points (3) but BEHIND on goals
    // (lost its only win 1-0 -> GD -2). These must NOT count against A3.
    const weak = (['F', 'G', 'H'] as GroupLetter[]).map((L) => finishedThird3(L, 1));
    // 3 still-playing groups -> conservative beaters (could reach 3+). Total real beaters = 7.
    const open = (['I', 'J', 'K'] as GroupLetter[]).map((L) => unfinishedGroup(L));

    const bundles = [target, ...fourPt, ...weak, ...open];
    const teams = bundles.flatMap((b) => b.teams);
    const matches = bundles.flatMap((b) => b.matches);

    const q = computeQualification(teams, matches);
    // 4 four-point thirds + 3 open groups = 7 possible beaters <= 7, so A3 is locked
    // into a best-8 third place. The three level-on-points-but-behind-on-goals thirds
    // (F3/G3/H3) are correctly excluded — counting them (the old points-only bug) would
    // give 10 and wrongly leave A3 'alive'.
    expect(q.byTeam['A3']!.clinchedRank).toBe(3);
    expect(q.byTeam['A3']!.outlook).toBe('qualified_third');
    // sanity: the weaker finished thirds are not themselves promoted to qualified.
    expect(q.byTeam['F3']!.outlook).not.toBe('qualified_third');
  });

  it('eliminates a finished 3rd that is outside the best-8 only on goal tiebreakers (never left "alive")', () => {
    // Group stage fully over. Seven groups field a 3rd on 4 pts (the clear top 7).
    // Five more groups have a 3rd on exactly 3 pts; only goal difference orders them.
    // Target A3 has the weakest goal difference of the five, so it is the 12th-best
    // third and is mathematically eliminated — but only the FULL tiebreaker proves
    // it. A points-only elimination check finds just 7 thirds strictly ahead, so the
    // old logic left A3 stuck on 'alive' forever. It must resolve to 'eliminated'.
    const fourPt = (['B', 'C', 'D', 'E', 'F', 'G', 'H'] as GroupLetter[]).map((L) => finishedGroupThird4(L));
    const target = finishedThird3('A', 1); // 3 pts, GD -1 (weakest)
    const stronger = [
      finishedThird3('I', 6), // 3 pts, GD +4
      finishedThird3('J', 4), // 3 pts, GD +2
      finishedThird3('K', 3), // 3 pts, GD +1
      finishedThird3('L', 2), // 3 pts, GD  0
    ];

    const bundles = [target, ...fourPt, ...stronger];
    const teams = bundles.flatMap((b) => b.teams);
    const matches = bundles.flatMap((b) => b.matches);

    const q = computeQualification(teams, matches);
    expect(q.byTeam['A3']!.clinchedRank).toBe(3); // locked 3rd in its own group
    expect(q.byTeam['A3']!.outlook).not.toBe('alive');
    expect(q.byTeam['A3']!.outlook).toBe('eliminated');
    // The strongest 3-pt third still squeaks into the best-8.
    expect(q.byTeam['I3']!.outlook).toBe('qualified_third');
  });
});
