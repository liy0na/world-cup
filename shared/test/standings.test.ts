import { describe, expect, it } from 'vitest';
import { computeGroupTable, fairPlayPoints } from '../src/standings';
import type { Team } from '../src/types';
import { cards, result, team } from './helpers';

const ids = (t: { rows: { teamId: string }[] }) => t.rows.map((r) => r.teamId);

describe('fairPlayPoints', () => {
  it('is 0 with no cards and negative with cards', () => {
    expect(fairPlayPoints(undefined)).toBe(0);
    expect(fairPlayPoints(cards(2, 0, 0))).toBe(-2);
    expect(fairPlayPoints(cards(1, 1, 1))).toBe(-(1 + 3 + 4));
  });
});

describe('computeGroupTable — primary ordering', () => {
  const teams: Team[] = [team('t1', 'A'), team('t2', 'A'), team('t3', 'A'), team('t4', 'A')];

  it('orders by points', () => {
    const matches = [
      result('A', 't1', 't2', 1, 0),
      result('A', 't1', 't3', 1, 0),
      result('A', 't1', 't4', 1, 0),
      result('A', 't2', 't3', 1, 0),
      result('A', 't2', 't4', 1, 0),
      result('A', 't3', 't4', 1, 0),
    ];
    const t = computeGroupTable('A', teams, matches);
    expect(ids(t)).toEqual(['t1', 't2', 't3', 't4']);
    expect(t.rows[0]!.points).toBe(9);
    expect(t.rows[0]!.rank).toBe(1);
  });

  it('breaks equal points by overall goal difference', () => {
    const matches = [
      result('A', 't1', 't2', 0, 0), // t1 & t2 both draw, then both beat t3/t4
      result('A', 't1', 't3', 3, 0),
      result('A', 't1', 't4', 3, 0),
      result('A', 't2', 't3', 1, 0),
      result('A', 't2', 't4', 1, 0),
      result('A', 't3', 't4', 0, 0),
    ];
    const t = computeGroupTable('A', teams, matches);
    expect(t.rows[0]!.teamId).toBe('t1'); // GD +6 beats t2's +2
    expect(t.rows[1]!.teamId).toBe('t2');
  });
});

describe('computeGroupTable — head-to-head', () => {
  const teams: Team[] = [team('t1', 'A'), team('t2', 'A'), team('t3', 'A'), team('t4', 'A')];

  it('separates two teams tied on points/GD/goals by their head-to-head result', () => {
    const matches = [
      result('A', 't1', 't2', 2, 1), // t1 wins the head-to-head
      result('A', 't3', 't1', 1, 0),
      result('A', 't1', 't4', 2, 0),
      result('A', 't2', 't3', 2, 0),
      result('A', 't2', 't4', 1, 0),
      result('A', 't4', 't3', 1, 0),
    ];
    const t = computeGroupTable('A', teams, matches);
    // t1 and t2 both: 6 pts, GD +2, GF 4 -> head-to-head puts t1 first.
    const r1 = t.rows.find((r) => r.teamId === 't1')!;
    const r2 = t.rows.find((r) => r.teamId === 't2')!;
    expect(r1.points).toBe(6);
    expect(r2.points).toBe(6);
    expect(r1.gd).toBe(2);
    expect(r2.gd).toBe(2);
    expect(r1.rank).toBe(1);
    expect(r2.rank).toBe(2);
  });
});

describe('computeGroupTable — fair-play and FIFA ranking fallbacks', () => {
  it('uses fair-play points when teams are otherwise identical', () => {
    const teams: Team[] = [team('t1', 'A'), team('t2', 'A'), team('t3', 'A'), team('t4', 'A')];
    const matches = [
      result('A', 't1', 't2', 0, 0),
      result('A', 't1', 't3', 1, 0),
      result('A', 't1', 't4', 1, 0),
      result('A', 't2', 't3', 1, 0),
      result('A', 't2', 't4', 1, 0, { homeCards: cards(0, 0, 1) }), // t2 picks up a red
      result('A', 't3', 't4', 0, 0),
    ];
    const t = computeGroupTable('A', teams, matches);
    // t1 & t2 identical (7 pts, GD +2, GF 2, 0-0 h2h); t2's red card drops it below t1.
    expect(t.rows[0]!.teamId).toBe('t1');
    expect(t.rows[1]!.teamId).toBe('t2');
  });

  it('falls back to FIFA World Ranking last', () => {
    const teams: Team[] = [
      team('t1', 'A', 5),
      team('t2', 'A', 10),
      team('t3', 'A'),
      team('t4', 'A'),
    ];
    const matches = [
      result('A', 't1', 't2', 0, 0),
      result('A', 't1', 't3', 1, 0),
      result('A', 't1', 't4', 1, 0),
      result('A', 't2', 't3', 1, 0),
      result('A', 't2', 't4', 1, 0),
      result('A', 't3', 't4', 0, 0),
    ];
    const t = computeGroupTable('A', teams, matches);
    expect(t.rows[0]!.teamId).toBe('t1'); // better (lower) FIFA ranking
    expect(t.rows[1]!.teamId).toBe('t2');
  });
});

describe('computeGroupTable — live and partial', () => {
  it('counts in-progress matches at their current score', () => {
    const teams: Team[] = [team('t1', 'A'), team('t2', 'A')];
    const matches = [result('A', 't1', 't2', 1, 0, { status: 'live' })];
    const t = computeGroupTable('A', teams, matches);
    expect(t.rows[0]!.teamId).toBe('t1');
    expect(t.rows[0]!.points).toBe(3);
    expect(t.rows[0]!.played).toBe(1);
  });

  it('ignores scheduled matches', () => {
    const teams: Team[] = [team('t1', 'A'), team('t2', 'A')];
    const matches = [result('A', 't1', 't2', 0, 0, { status: 'scheduled' })];
    const t = computeGroupTable('A', teams, matches);
    expect(t.rows.every((r) => r.played === 0)).toBe(true);
  });
});
