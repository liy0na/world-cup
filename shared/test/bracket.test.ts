import { describe, expect, it } from 'vitest';
import { buildBracket } from '../src/bracket';
import { KNOCKOUT_MATCHES } from '../src/data/bracketStructure';
import { THIRD_PLACE_COMBINATIONS } from '../src/data/thirdPlaceCombinations';
import type { GroupLetter, Match, ThirdPlaceRanking } from '../src/types';
import { tableInOrder } from './helpers';

/** A finished knockout result keyed only by match number (overlaid by buildBracket). */
function koResult(
  matchNumber: number,
  homeScore: number,
  awayScore: number,
  opts: { penalties?: { home: number; away: number }; afterExtraTime?: boolean; venue?: string } = {},
): Match {
  return {
    id: `m${matchNumber}`,
    stage: 'r32',
    matchNumber,
    kickoff: '2026-06-28T00:00:00Z',
    venue: opts.venue,
    status: 'finished',
    home: { source: '', label: '' },
    away: { source: '', label: '' },
    homeScore,
    awayScore,
    penalties: opts.penalties,
    afterExtraTime: opts.afterExtraTime,
  };
}

const LETTERS: GroupLetter[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

// 12 group tables with deterministic teams "<G>1".."<G>4" in finishing order.
const tables = LETTERS.map((g) => tableInOrder(g, [`${g}1`, `${g}2`, `${g}3`, `${g}4`]));

function ranking(qualifyingGroups: GroupLetter[]): ThirdPlaceRanking {
  return { rows: [], qualifyingGroups };
}

const find = (bracket: ReturnType<typeof buildBracket>, n: number) =>
  [...bracket.r32, ...bracket.r16, ...bracket.qf, ...bracket.sf, ...bracket.third, ...bracket.final].find(
    (m) => m.matchNumber === n,
  )!;

describe('combination table integrity', () => {
  it('has all 495 combinations, each a valid 8-slot assignment', () => {
    const keys = Object.keys(THIRD_PLACE_COMBINATIONS);
    expect(keys).toHaveLength(495);
    const winnerCols = ['A', 'B', 'D', 'E', 'G', 'I', 'K', 'L'];
    for (const key of keys) {
      const qualifying = key.split('');
      expect(qualifying).toHaveLength(8);
      const assign = THIRD_PLACE_COMBINATIONS[key]!;
      const values = Object.values(assign);
      expect(Object.keys(assign).sort()).toEqual(winnerCols);
      expect(new Set(values).size).toBe(8); // all distinct
      for (const g of values) expect(qualifying).toContain(g); // drawn from qualifiers
    }
  });
});

describe('buildBracket — Round of 32 slotting', () => {
  // Qualifying thirds E,F,G,H,I,J,K,L => key EFGHIJKL =>
  // {A:E, B:J, D:I, E:F, G:H, I:G, K:L, L:K}
  const bracket = buildBracket(tables, ranking(['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']));

  it('places group winners and runners-up correctly', () => {
    expect(find(bracket, 73).home.teamId).toBe('A2'); // Runner-up A
    expect(find(bracket, 73).away.teamId).toBe('B2'); // Runner-up B
    expect(find(bracket, 74).home.teamId).toBe('E1'); // Winner E
    expect(find(bracket, 75).home.teamId).toBe('F1'); // Winner F
    expect(find(bracket, 75).away.teamId).toBe('C2'); // Runner-up C
    expect(find(bracket, 88).away.teamId).toBe('G2'); // Runner-up G
  });

  it('resolves third-place slots via the FIFA combination table', () => {
    expect(find(bracket, 74).away.teamId).toBe('F3'); // 1E vs 3rd col E -> F
    expect(find(bracket, 79).away.teamId).toBe('E3'); // 1A vs 3rd col A -> E
    expect(find(bracket, 80).away.teamId).toBe('K3'); // 1L vs 3rd col L -> K
    expect(find(bracket, 81).away.teamId).toBe('I3'); // 1D vs 3rd col D -> I
    expect(find(bracket, 82).away.teamId).toBe('H3'); // 1G vs 3rd col G -> H
    expect(find(bracket, 77).away.teamId).toBe('G3'); // 1I vs 3rd col I -> G
    expect(find(bracket, 85).away.teamId).toBe('J3'); // 1B vs 3rd col B -> J
    expect(find(bracket, 87).away.teamId).toBe('L3'); // 1K vs 3rd col K -> L
  });

  it('never pairs a third against the winner of its own group', () => {
    for (const m of bracket.r32) {
      if (m.home.teamId && m.away.teamId) {
        const homeGroup = m.home.teamId[0];
        const awayGroup = m.away.teamId[0];
        expect(homeGroup).not.toBe(awayGroup);
      }
    }
  });
});

describe('buildBracket — later rounds and edge cases', () => {
  it('leaves later-round slots as match-winner placeholders', () => {
    const bracket = buildBracket(tables, ranking(['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']));
    const r16 = find(bracket, 89);
    expect(r16.home.teamId).toBeUndefined();
    expect(r16.home.label).toBe('Winner M74');
    expect(r16.away.label).toBe('Winner M77');
    expect(find(bracket, 103).home.label).toBe('Loser M101');
    expect(find(bracket, 104).home.label).toBe('Winner M101');
  });

  it('shows the allowed-group set when thirds are not yet determined', () => {
    const bracket = buildBracket(tables, ranking([])); // no key match
    const m74 = find(bracket, 74);
    expect(m74.away.teamId).toBeUndefined();
    expect(m74.away.label).toBe('3rd A/B/C/D/F');
  });

  it('propagates a Round-of-32 winner into the Round of 16', () => {
    // M73 = Runner-up A (A2) vs Runner-up B (B2); its winner feeds M90's home slot.
    const bracket = buildBracket(tables, ranking(['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']), [
      koResult(73, 2, 0),
    ]);
    expect(find(bracket, 73).winnerTeamId).toBe('A2');
    expect(find(bracket, 90).home.teamId).toBe('A2'); // resolved team flows into the next round
  });

  it('decides a level match on penalties and propagates the shoot-out winner', () => {
    // M74 = Winner E (E1) vs 3rd C (C3); level after 120, E win on penalties.
    const bracket = buildBracket(tables, ranking(['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']), [
      koResult(74, 1, 1, { afterExtraTime: true, penalties: { home: 4, away: 3 } }),
    ]);
    expect(find(bracket, 74).winnerTeamId).toBe('E1');
    expect(find(bracket, 89).home.teamId).toBe('E1'); // M89 home = Winner M74
  });

  it('propagates a full set of results to the final and third-place match', () => {
    const allHomeWins: Match[] = [];
    for (let n = 73; n <= 104; n++) allHomeWins.push(koResult(n, 1, 0));
    const bracket = buildBracket(tables, ranking(['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']), allHomeWins);
    expect(find(bracket, 104).home.teamId).toBeDefined(); // final has two real teams
    expect(find(bracket, 104).away.teamId).toBeDefined();
    expect(find(bracket, 104).winnerTeamId).toBeDefined(); // a champion
    expect(find(bracket, 103).home.teamId).toBeDefined(); // third place fed by SF losers
    expect(find(bracket, 103).away.teamId).toBeDefined();
  });

  it('carries the venue and kickoff from the actual knockout match onto the bracket card', () => {
    const bracket = buildBracket(tables, ranking(['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']), [
      koResult(73, 2, 0, { venue: 'Dallas' }),
    ]);
    expect(find(bracket, 73).venue).toBe('Dallas');
    expect(find(bracket, 73).kickoff).toBe('2026-06-28T00:00:00Z');
    expect(find(bracket, 74).venue).toBeUndefined(); // no actual match supplied
    expect(find(bracket, 74).kickoff).toBeUndefined();
  });

  it('produces the full 32-match knockout structure', () => {
    const bracket = buildBracket(tables, ranking(['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']));
    expect(bracket.r32).toHaveLength(16);
    expect(bracket.r16).toHaveLength(8);
    expect(bracket.qf).toHaveLength(4);
    expect(bracket.sf).toHaveLength(2);
    expect(bracket.third).toHaveLength(1);
    expect(bracket.final).toHaveLength(1);
    expect(KNOCKOUT_MATCHES).toHaveLength(32);
  });
});
