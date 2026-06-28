import { describe, expect, it } from 'vitest';
import { simulateKnockout } from '../src/knockout';
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

/** A full 48-team field with every group game played: ranks 1..4 are id1..id4. */
function finishedGroups(): { teams: Team[]; matches: Match[] } {
  const teams: Team[] = [];
  const matches: Match[] = [];
  GROUP_LETTERS.forEach((L) => {
    const ids = [0, 1, 2, 3].map((i) => `${L}${i + 1}`);
    ids.forEach((id, i) => teams.push(team(id, L as GroupLetter, i + 1)));
    const pairs: [number, number][] = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ];
    // Lower index wins 2-0 → deterministic 1,2,3,4 finishing order.
    pairs.forEach(([a, b]) => matches.push(result(L as GroupLetter, ids[a]!, ids[b]!, 2, 0)));
  });
  return { teams, matches };
}

describe('simulateKnockout', () => {
  it('is not ready until the group stage is complete', () => {
    const { teams, matches } = finishedGroups();
    // Reopen one group game so the bracket cannot resolve its Round-of-32 teams.
    const open = matches.map((m, i) => (i === 0 ? { ...m, status: 'scheduled' as const } : m));
    const odds = simulateKnockout(teams, open, { iterations: 50, rng: rng(1) });
    expect(odds.ready).toBe(false);
    expect(odds.iterations).toBe(0);
  });

  it('keeps the round invariants on every run (champions sum to 1, finalists to 2, …)', () => {
    const { teams, matches } = finishedGroups();
    const odds = simulateKnockout(teams, matches, { iterations: 400, rng: rng(7) });
    expect(odds.ready).toBe(true);
    expect(odds.iterations).toBe(400);

    const all = Object.values(odds.byTeam);
    const sum = (k: 'reachR16' | 'reachQF' | 'reachSF' | 'reachFinal' | 'champion') =>
      all.reduce((s, o) => s + o[k], 0);
    // One champion, two finalists, four semi-finalists, eight quarter-finalists,
    // sixteen round-of-16 teams — every single simulated tournament.
    expect(sum('champion')).toBeCloseTo(1, 5);
    expect(sum('reachFinal')).toBeCloseTo(2, 5);
    expect(sum('reachSF')).toBeCloseTo(4, 5);
    expect(sum('reachQF')).toBeCloseTo(8, 5);
    expect(sum('reachR16')).toBeCloseTo(16, 5);

    for (const o of all) {
      // Monotonic: you cannot win without reaching the final, etc.
      expect(o.champion).toBeLessThanOrEqual(o.reachFinal + 1e-9);
      expect(o.reachFinal).toBeLessThanOrEqual(o.reachSF + 1e-9);
      expect(o.reachSF).toBeLessThanOrEqual(o.reachQF + 1e-9);
      expect(o.reachQF).toBeLessThanOrEqual(o.reachR16 + 1e-9);
      expect(o.reachR16).toBeLessThanOrEqual(1 + 1e-9);
    }
    // Only the 32 knockout qualifiers ever win a tie; the 16 eliminated do not.
    const everReached = all.filter((o) => o.reachR16 > 0);
    expect(everReached.length).toBeLessThanOrEqual(32);
  });

  it('rates a hugely stronger team to win far more often', () => {
    const { teams, matches } = finishedGroups();
    // Give A1 (a group winner, so it is in the bracket) a runaway rating edge.
    const ratings: Record<string, number> = { A1: 2600 };
    for (const t of teams) if (t.id !== 'A1') ratings[t.id] = 1500;
    const odds = simulateKnockout(teams, matches, { iterations: 800, rng: rng(3), ratings });
    // The favourite should top the title odds and clear a sensible floor.
    const champ = Object.values(odds.byTeam).sort((a, b) => b.champion - a.champion)[0]!;
    expect(champ.teamId).toBe('A1');
    expect(champ.champion).toBeGreaterThan(0.25);
  });

  it('holds a finished knockout result fixed across all runs', () => {
    const { teams, matches } = finishedGroups();
    // Find the two teams in Round-of-32 match 73 (runner-up A vs runner-up B = A2, B2),
    // and play it as a finished upset so A2 always advances.
    const ko: Match = {
      id: 'm73',
      stage: 'r32',
      matchNumber: 73,
      kickoff: '2026-07-01T00:00:00Z',
      status: 'finished',
      home: { source: '2A', label: 'Runner-up A', teamId: 'A2' },
      away: { source: '2B', label: 'Runner-up B', teamId: 'B2' },
      homeScore: 1,
      awayScore: 0,
    };
    const odds = simulateKnockout(teams, [...matches, ko], { iterations: 200, rng: rng(5) });
    // A2 won its tie in reality, so it reaches the R16 in 100% of runs; B2 never does.
    expect(odds.byTeam['A2']!.reachR16).toBeCloseTo(1, 5);
    expect(odds.byTeam['B2']!.reachR16).toBeCloseTo(0, 5);
  });
});
