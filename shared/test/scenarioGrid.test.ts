import { describe, expect, it } from 'vitest';
import { computeScenarioGrid } from '../src/scenarioGrid';
import type { GroupLetter, Match, Team } from '../src/types';
import { result, team } from './helpers';

/**
 * A group on its FINAL matchday: the four cross games are finished 0-0, leaving
 * the two same-day games (team1 v team2 and team3 v team4) open. Every team sits
 * on 2 points before the last round. FIFA rankings 1<2<3<4 break dead-level ties.
 */
function finalMatchdayGroup(L: GroupLetter): { teams: Team[]; matches: Match[] } {
  const [a, b, c, d] = [`${L}1`, `${L}2`, `${L}3`, `${L}4`];
  return {
    teams: [team(a, L, 1), team(b, L, 2), team(c, L, 3), team(d, L, 4)],
    matches: [
      result(L, a, c, 0, 0),
      result(L, a, d, 0, 0),
      result(L, b, c, 0, 0),
      result(L, b, d, 0, 0),
      result(L, a, b, 0, 0, { status: 'scheduled' }), // open
      result(L, c, d, 0, 0, { status: 'scheduled' }), // open
    ],
  };
}

describe('computeScenarioGrid', () => {
  it('returns undefined before the final matchday (more than two open games)', () => {
    const teams = [team('A1', 'A'), team('A2', 'A'), team('A3', 'A'), team('A4', 'A')];
    const matches: Match[] = [
      result('A', 'A1', 'A2', 1, 0),
      result('A', 'A1', 'A3', 0, 0, { status: 'scheduled' }),
      result('A', 'A1', 'A4', 0, 0, { status: 'scheduled' }),
      result('A', 'A2', 'A3', 0, 0, { status: 'scheduled' }),
      result('A', 'A2', 'A4', 0, 0, { status: 'scheduled' }),
      result('A', 'A3', 'A4', 0, 0, { status: 'scheduled' }),
    ];
    expect(computeScenarioGrid('A', teams, matches)).toBeUndefined();
  });

  it('builds a square grid sized to the two open games', () => {
    const { teams, matches } = finalMatchdayGroup('L');
    const grid = computeScenarioGrid('L', teams, matches, 2)!; // 0,1,2 goals → 9 scorelines
    expect(grid).toBeDefined();
    expect(grid.col).toEqual({ matchId: expect.any(String), team1: 'L1', team2: 'L2' });
    expect(grid.row).toEqual({ matchId: expect.any(String), team1: 'L3', team2: 'L4' });
    expect(grid.cols).toHaveLength(9);
    expect(grid.rows).toHaveLength(9);
    expect(grid.cells).toHaveLength(9);
    expect(grid.cells[0]).toHaveLength(9);
  });

  it('orders columns from best-for-team1 to best-for-team2', () => {
    const { teams, matches } = finalMatchdayGroup('L');
    const grid = computeScenarioGrid('L', teams, matches, 2)!;
    // Biggest team1 win first, narrowest draw band in the middle, biggest team2 win last.
    expect(grid.cols[0]).toEqual({ s1: 2, s2: 0, result: 'team1' });
    expect(grid.cols[3]).toEqual({ s1: 0, s2: 0, result: 'draw' });
    expect(grid.cols[8]).toEqual({ s1: 0, s2: 2, result: 'team2' });
  });

  it('resolves margin-dependent finishes and flags fair-play / ranking ties', () => {
    const { teams, matches } = finalMatchdayGroup('L');
    const grid = computeScenarioGrid('L', teams, matches, 2)!;
    // Column 0 = L1 beats L2 2-0; row 3 = L3 draws L4 0-0.
    const cell = grid.cells[3]![0]!;
    // L1 wins → 1st; L2 loses → 4th. L3 & L4 finish level on everything but FIFA rank.
    expect(cell.ranks['L1']).toBe(1);
    expect(cell.ranks['L2']).toBe(4);
    expect(cell.ranks['L3']).toBe(2); // better FIFA ranking
    expect(cell.ranks['L4']).toBe(3);
    expect(new Set(cell.decidedByTiebreak)).toEqual(new Set(['L3', 'L4']));
  });

  it('does not flag a tiebreak when goal difference separates the teams', () => {
    const { teams, matches } = finalMatchdayGroup('L');
    const grid = computeScenarioGrid('L', teams, matches, 2)!;
    // Column 0 = L1 beats L2 2-0 (+2); row 2 = L3 beats L4 1-0 (+1).
    // L1 & L3 both finish on 5 pts and drew head-to-head, so goal difference
    // (+2 vs +1) decides between them — no discipline/ranking tiebreak.
    const cell = grid.cells[2]![0]!;
    expect(cell.ranks['L1']).toBe(1);
    expect(cell.ranks['L3']).toBe(2);
    expect(cell.decidedByTiebreak).toHaveLength(0);
  });

  it('defaults to a 25-scoreline (0..4 goals) axis', () => {
    const { teams, matches } = finalMatchdayGroup('L');
    const grid = computeScenarioGrid('L', teams, matches)!;
    expect(grid.cols).toHaveLength(25);
    expect(grid.rows).toHaveLength(25);
  });
});
