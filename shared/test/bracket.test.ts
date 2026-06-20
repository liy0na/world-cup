import { describe, expect, it } from 'vitest';
import { buildBracket } from '../src/bracket';
import { KNOCKOUT_MATCHES } from '../src/data/bracketStructure';
import { THIRD_PLACE_COMBINATIONS } from '../src/data/thirdPlaceCombinations';
import type { GroupLetter, ThirdPlaceRanking } from '../src/types';
import { tableInOrder } from './helpers';

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
