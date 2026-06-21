import { describe, expect, it } from 'vitest';
import { computeTopScorers } from '../src/scorers';
import type { GoalEvent, Match } from '../src/types';

function goal(teamId: string, playerId: string, player: string, kind: GoalEvent['kind'] = 'goal'): GoalEvent {
  return { teamId, playerId, player, minute: "10'", kind, order: 0 };
}

function match(id: string, goals: GoalEvent[], lineup: string[] = []): Match {
  return {
    id,
    stage: 'group',
    kickoff: '2026-06-12T00:00:00Z',
    status: 'finished',
    home: { source: '', label: '', teamId: 'X' },
    away: { source: '', label: '', teamId: 'Y' },
    homeScore: 0,
    awayScore: 0,
    goals,
    lineup,
  };
}

describe('computeTopScorers', () => {
  it('aggregates a player across matches and counts penalties + games played', () => {
    const matches = [
      // Mbappe (p1) plays m1, m2, m3; scores in m1 (x2, one pen) and m2.
      match('m1', [goal('FRA', 'p1', 'Mbappe'), goal('FRA', 'p1', 'Mbappe', 'penalty')], ['p1', 'p2']),
      match('m2', [goal('FRA', 'p1', 'Mbappe')], ['p1', 'p2']),
      match('m3', [], ['p1']), // appeared but didn't score
    ];
    const rows = computeTopScorers(matches);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ playerId: 'p1', player: 'Mbappe', goals: 3, penalties: 1, matchesPlayed: 3, rank: 1 });
  });

  it('excludes own goals from the scorer tally', () => {
    const matches = [match('m1', [goal('ARG', 'p9', 'Defender', 'own'), goal('BRA', 'p2', 'Neymar')])];
    const rows = computeTopScorers(matches);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.player).toBe('Neymar');
    expect(rows[0]!.goals).toBe(1);
  });

  it('ranks by goals with ties sharing a rank', () => {
    const matches = [
      match('m1', [goal('A', 'a', 'AAA'), goal('A', 'a', 'AAA'), goal('B', 'b', 'BBB'), goal('C', 'c', 'CCC')]),
    ];
    const rows = computeTopScorers(matches);
    expect(rows[0]).toMatchObject({ player: 'AAA', goals: 2, rank: 1 });
    // BBB and CCC both have 1 goal -> both rank 2.
    expect(rows[1]!.rank).toBe(2);
    expect(rows[2]!.rank).toBe(2);
  });
});
