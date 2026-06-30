import { describe, expect, it } from 'vitest';
import type { Bracket, Match, Team } from '@wc/shared';
import { mergeLive, resolveKnockoutFixtures } from '../src/pipeline/matchStore';
import type { LiveObservation, Schedule } from '../src/providers/provider';

const team = (id: string, name: string): Team => ({ id, name, code: id, group: 'E' });

const schedule: Schedule = {
  teams: [team('GER', 'Germany'), team('CIV', 'Ivory Coast')],
  matches: [
    {
      id: 'm',
      stage: 'group',
      group: 'E',
      kickoff: '2026-06-21T00:00:00Z',
      status: 'scheduled',
      home: { source: 'GER', label: 'Germany', teamId: 'GER' },
      away: { source: 'CIV', label: 'Ivory Coast', teamId: 'CIV' },
    },
  ],
};

describe('mergeLive', () => {
  it('matches by FIFA code despite a different name spelling (Côte d\'Ivoire vs Ivory Coast)', () => {
    const obs: LiveObservation[] = [
      { homeName: 'Germany', awayName: "Côte d'Ivoire", homeCode: 'GER', awayCode: 'CIV', homeScore: 1, awayScore: 0, minute: 14 },
    ];
    const m = mergeLive(schedule, obs)[0]!;
    expect(m.status).toBe('live');
    expect(m.minute).toBe(14);
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(0);
  });

  it('falls back to name matching when no code is provided', () => {
    const obs: LiveObservation[] = [{ homeName: 'Germany', awayName: 'Ivory Coast', homeScore: 2, awayScore: 2 }];
    const m = mergeLive(schedule, obs)[0]!;
    expect(m.status).toBe('live');
    expect(m.homeScore).toBe(2);
  });

  it('orients the score to the fixture when the live feed lists teams reversed', () => {
    const obs: LiveObservation[] = [{ homeName: 'Ivory Coast', awayName: 'Germany', homeCode: 'CIV', awayCode: 'GER', homeScore: 3, awayScore: 1 }];
    const m = mergeLive(schedule, obs)[0]!;
    expect(m.homeScore).toBe(1); // Germany is the fixture's home team
    expect(m.awayScore).toBe(3);
  });

  it('records a finished result (so the score survives leaving the live feed)', () => {
    const obs: LiveObservation[] = [
      { homeName: 'Germany', awayName: "Côte d'Ivoire", homeCode: 'GER', awayCode: 'CIV', homeScore: 2, awayScore: 1, finished: true },
    ];
    const m = mergeLive(schedule, obs)[0]!;
    expect(m.status).toBe('finished');
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(1);
  });

  it('carries penalties oriented to the fixture (knockout shoot-out)', () => {
    const obs: LiveObservation[] = [
      { homeName: 'Ivory Coast', awayName: 'Germany', homeCode: 'CIV', awayCode: 'GER', homeScore: 1, awayScore: 1, penaltyHome: 5, penaltyAway: 4, finished: true },
    ];
    const m = mergeLive(schedule, obs)[0]!;
    expect(m.status).toBe('finished');
    expect(m.penalties).toEqual({ home: 4, away: 5 }); // Germany (fixture home) won 4? no — oriented: GER 4, CIV 5
  });
});

describe('resolveKnockoutFixtures', () => {
  const koFixture = (matchNumber: number): Match => ({
    id: `m${matchNumber}`,
    stage: 'r32',
    matchNumber,
    kickoff: '2026-06-28T00:00:00Z',
    status: 'scheduled',
    home: { source: '2A', label: 'Runner-up A' }, // placeholder, no teamId yet
    away: { source: '2B', label: 'Runner-up B' },
  });

  const bracketWith = (matchNumber: number, home?: string, away?: string): Bracket => {
    const m = {
      matchNumber,
      stage: 'r32' as const,
      home: { source: '2A', label: 'Runner-up A', teamId: home },
      away: { source: '2B', label: 'Runner-up B', teamId: away },
    };
    return { r32: [m], r16: [], qf: [], sf: [], third: [], final: [] };
  };

  it('fills unresolved knockout slots from the projected bracket', () => {
    const [m] = resolveKnockoutFixtures([koFixture(73)], bracketWith(73, 'GER', 'CIV'));
    expect(m!.home.teamId).toBe('GER');
    expect(m!.away.teamId).toBe('CIV');
  });

  it('never overwrites a team already resolved on the fixture', () => {
    const fixture = koFixture(73);
    fixture.home = { source: 'GER', label: 'Germany', teamId: 'GER' };
    const [m] = resolveKnockoutFixtures([fixture], bracketWith(73, 'BRA', 'CIV'));
    expect(m!.home.teamId).toBe('GER'); // real name on the fixture stands
    expect(m!.away.teamId).toBe('CIV');
  });

  it('leaves a slot unresolved when the bracket cannot resolve it either', () => {
    const [m] = resolveKnockoutFixtures([koFixture(73)], bracketWith(73, undefined, 'CIV'));
    expect(m!.home.teamId).toBeUndefined();
    expect(m!.away.teamId).toBe('CIV');
  });

  it('leaves group matches untouched', () => {
    const group = schedule.matches[0]!;
    const [m] = resolveKnockoutFixtures([group], bracketWith(73, 'GER', 'CIV'));
    expect(m).toBe(group); // same reference — no needless copy
  });
});
