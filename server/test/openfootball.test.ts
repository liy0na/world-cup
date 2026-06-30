import { describe, expect, it } from 'vitest';
import { parse } from '../src/providers/openfootball';

const groups = {
  name: 'World Cup 2026',
  groups: [{ name: 'Group A', teams: ['Germany', 'Paraguay'] }],
};

/** A knockout fixture by match number with an arbitrary score object. */
const ko = (num: number, score: unknown) => ({
  round: 'Round of 32',
  num,
  date: '2026-06-30',
  team1: 'Germany',
  team2: 'Paraguay',
  score,
});

const parseOne = (score: unknown) =>
  parse(groups as never, { name: 'x', matches: [ko(74, score)] } as never).matches[0]!;

describe('openfootball parse — knockout scorelines', () => {
  it('decides a shoot-out: stores the level AET score, the penalties and the FT score', () => {
    const m = parseOne({ ft: [1, 1], et: [2, 2], p: [4, 3] });
    expect(m.status).toBe('finished');
    expect(m.homeScore).toBe(2); // after extra time
    expect(m.awayScore).toBe(2);
    expect(m.afterExtraTime).toBe(true);
    expect(m.penalties).toEqual({ home: 4, away: 3 });
    expect(m.fullTime).toEqual({ home: 1, away: 1 }); // 90' score retained
  });

  it('handles a shoot-out with no goals in extra time (FT == AET)', () => {
    const m = parseOne({ ft: [1, 1], et: [1, 1], p: [5, 4] });
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(1);
    expect(m.penalties).toEqual({ home: 5, away: 4 });
    expect(m.fullTime).toEqual({ home: 1, away: 1 });
  });

  it('uses the extra-time score for a tie won in extra time (no shoot-out)', () => {
    const m = parseOne({ ft: [0, 0], et: [2, 1] });
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(1);
    expect(m.afterExtraTime).toBe(true);
    expect(m.penalties).toBeUndefined();
    expect(m.fullTime).toEqual({ home: 0, away: 0 });
  });

  it('leaves a regulation result untouched (no AET/penalties/FT extras)', () => {
    const m = parseOne({ ft: [2, 1] });
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(1);
    expect(m.afterExtraTime).toBeUndefined();
    expect(m.penalties).toBeUndefined();
    expect(m.fullTime).toBeUndefined();
  });

  it('marks a match with no score as scheduled', () => {
    const m = parseOne(undefined);
    expect(m.status).toBe('scheduled');
    expect(m.homeScore).toBeUndefined();
  });
});
