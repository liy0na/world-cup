import { describe, expect, it } from 'vitest';
import { rankThirdPlacedTeams } from '../src/thirds';
import type { GroupLetter, GroupTable, StandingRow, Team } from '../src/types';

/** A group table where only the 3rd-placed row's stats matter for this test. */
function tableWithThird(
  group: GroupLetter,
  third: { points: number; gd: number; gf: number; fairPlay?: number },
): GroupTable {
  const mk = (teamId: string, rank: number, points: number, extra: Partial<StandingRow> = {}): StandingRow => ({
    teamId,
    rank,
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: extra.gf ?? 0,
    ga: 0,
    gd: extra.gd ?? 0,
    points,
    fairPlay: extra.fairPlay ?? 0,
  });
  return {
    group,
    rows: [
      mk(`${group}1`, 1, 9),
      mk(`${group}2`, 2, 6),
      mk(`${group}3`, 3, third.points, { gd: third.gd, gf: third.gf, fairPlay: third.fairPlay ?? 0 }),
      mk(`${group}4`, 4, 0),
    ],
  };
}

const LETTERS: GroupLetter[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

describe('rankThirdPlacedTeams', () => {
  it('ranks all 12 thirds and qualifies the best 8', () => {
    // Give each group's third a descending points total A(highest)..L(lowest).
    const tables = LETTERS.map((g, i) =>
      tableWithThird(g, { points: 12 - i, gd: 0, gf: 0 }),
    );
    const teams: Team[] = [];
    const ranking = rankThirdPlacedTeams(tables, teams);

    expect(ranking.rows).toHaveLength(12);
    expect(ranking.rows[0]!.group).toBe('A');
    expect(ranking.rows[0]!.rank).toBe(1);
    expect(ranking.rows[0]!.qualifies).toBe(true);
    expect(ranking.rows[7]!.qualifies).toBe(true);
    expect(ranking.rows[8]!.qualifies).toBe(false);
    expect(ranking.qualifyingGroups).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });

  it('applies points -> GD -> goals ordering', () => {
    const tables = [
      tableWithThird('A', { points: 3, gd: 0, gf: 1 }),
      tableWithThird('B', { points: 3, gd: 2, gf: 3 }), // same pts, better GD
      tableWithThird('C', { points: 3, gd: 2, gf: 5 }), // same pts+GD, more goals
      tableWithThird('D', { points: 6, gd: 0, gf: 0 }), // most points
    ];
    const ranking = rankThirdPlacedTeams(tables, []);
    expect(ranking.rows.map((r) => r.group)).toEqual(['D', 'C', 'B', 'A']);
  });

  it('falls back to FIFA ranking when fully tied', () => {
    const tables = [
      tableWithThird('A', { points: 3, gd: 0, gf: 1 }),
      tableWithThird('B', { points: 3, gd: 0, gf: 1 }),
    ];
    const teams: Team[] = [
      { id: 'A3', name: 'A3', code: 'A3', group: 'A', fifaRanking: 20 },
      { id: 'B3', name: 'B3', code: 'B3', group: 'B', fifaRanking: 8 },
    ];
    const ranking = rankThirdPlacedTeams(tables, teams);
    expect(ranking.rows[0]!.group).toBe('B'); // better FIFA ranking wins
  });
});
