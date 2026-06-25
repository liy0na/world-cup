import { describe, expect, it } from 'vitest';
import { simulateAdvancement } from '../src/odds';
import { GROUP_LETTERS, type GroupLetter, type Match, type Team } from '../src/types';
import { result, team } from './helpers';

/** Deterministic 0..1 RNG (mulberry32) so simulations are reproducible in tests. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A full 48-team field: 12 groups, every game played (or optionally left open). */
function fullField(openLastGamePerGroup = 0): { teams: Team[]; matches: Match[] } {
  const teams: Team[] = [];
  const matches: Match[] = [];
  GROUP_LETTERS.forEach((L) => {
    const ids = [0, 1, 2, 3].map((i) => `${L}${i + 1}`);
    ids.forEach((id, i) => teams.push(team(id, L as GroupLetter, i + 1))); // fifaRanking 1..4 within group
    // Round-robin: lower index always wins 2-0 → ranks 1,2,3,4 are id1..id4.
    const pairs: [number, number][] = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ];
    pairs.forEach(([a, b], idx) => {
      const open = idx >= pairs.length - openLastGamePerGroup;
      matches.push(
        result(L as GroupLetter, ids[a]!, ids[b]!, open ? 0 : 2, 0, open ? { status: 'scheduled' } : {}),
      );
    });
  });
  return { teams, matches };
}

describe('simulateAdvancement', () => {
  it('is deterministic and exact once the group stage is complete', () => {
    const { teams, matches } = fullField(0);
    const odds = simulateAdvancement(teams, matches, { rng: rng(1) });
    expect(odds.iterations).toBe(1); // nothing left to simulate

    // Exactly 32 teams reach the R32, every probability is 0 or 1.
    const advancing = Object.values(odds.byTeam).filter((o) => o.advance === 1);
    expect(advancing).toHaveLength(32);
    for (const o of Object.values(odds.byTeam)) {
      expect(o.advance === 0 || o.advance === 1).toBe(true);
    }
    // Group winners (the "1"s) all advance.
    expect(odds.byTeam['A1']!.winGroup).toBe(1);
    expect(odds.byTeam['A1']!.advance).toBe(1);
    // The bottom team of every group is out.
    expect(odds.byTeam['A4']!.advance).toBe(0);
  });

  it('keeps the structural invariants every run with games still open', () => {
    const { teams, matches } = fullField(2); // two open games per group
    const odds = simulateAdvancement(teams, matches, { iterations: 300, rng: rng(7) });
    expect(odds.iterations).toBe(300);

    const all = Object.values(odds.byTeam);
    // 24 top-two slots + 8 best thirds = 32 advance on every single run.
    const sumAdvance = all.reduce((s, o) => s + o.advance, 0);
    expect(sumAdvance).toBeCloseTo(32, 5);
    const sumTopTwo = all.reduce((s, o) => s + o.topTwo, 0);
    expect(sumTopTwo).toBeCloseTo(24, 5);
    const sumWin = all.reduce((s, o) => s + o.winGroup, 0);
    expect(sumWin).toBeCloseTo(12, 5);

    for (const o of all) {
      // advance is exactly the disjoint union of top-two and best-third routes.
      expect(o.advance).toBeCloseTo(o.topTwo + o.bestThird, 5);
      expect(o.winGroup).toBeLessThanOrEqual(o.topTwo + 1e-9);
      expect(o.advance).toBeGreaterThanOrEqual(-1e-9);
      expect(o.advance).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('rates the stronger team to advance more often', () => {
    // One group where every game is open; ratings decide. Others fully played.
    const { teams, matches } = fullField(0);
    // Reopen all of group A's games and give A4 (rank-4 seed) a huge rating edge.
    const reopened = matches.map((m) =>
      m.group === 'A' ? { ...m, status: 'scheduled' as const, homeScore: undefined, awayScore: undefined } : m,
    );
    const ratings = { A1: 1300, A2: 1300, A3: 1300, A4: 2100 };
    const odds = simulateAdvancement(teams, reopened, { iterations: 500, rng: rng(3), ratings });
    expect(odds.byTeam['A4']!.advance).toBeGreaterThan(odds.byTeam['A1']!.advance);
    expect(odds.byTeam['A4']!.winGroup).toBeGreaterThan(0.4);
  });
});
