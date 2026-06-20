// The fixed knockout-stage structure of the 2026 FIFA World Cup (matches 73-104),
// verified against the official FIFA bracket via Wikipedia. The third-placed-team
// opponents are resolved at runtime through THIRD_PLACE_COMBINATIONS.
import type { GroupLetter, Stage } from '../types';

export type KoSlotSource =
  /** Group winner, e.g. "1A". */
  | { type: 'winner'; group: GroupLetter }
  /** Group runner-up, e.g. "2B". */
  | { type: 'runnerup'; group: GroupLetter }
  /** A best-third slot, resolved via the combination table for the given winner column. */
  | { type: 'third'; winnerColumn: GroupLetter; allowed: GroupLetter[] }
  /** Winner of an earlier knockout match, e.g. "W89". */
  | { type: 'matchWinner'; match: number }
  /** Loser of an earlier knockout match (third-place match only), e.g. "L101". */
  | { type: 'matchLoser'; match: number };

export interface KoMatchDef {
  matchNumber: number;
  stage: Exclude<Stage, 'group'>;
  home: KoSlotSource;
  away: KoSlotSource;
}

const w = (group: GroupLetter): KoSlotSource => ({ type: 'winner', group });
const r = (group: GroupLetter): KoSlotSource => ({ type: 'runnerup', group });
const third = (winnerColumn: GroupLetter, allowed: GroupLetter[]): KoSlotSource => ({
  type: 'third',
  winnerColumn,
  allowed,
});
const W = (match: number): KoSlotSource => ({ type: 'matchWinner', match });
const L = (match: number): KoSlotSource => ({ type: 'matchLoser', match });

export const KNOCKOUT_MATCHES: KoMatchDef[] = [
  // Round of 32 (73-88). Winner-vs-third pairings carry the allowed third-place groups.
  { matchNumber: 73, stage: 'r32', home: r('A'), away: r('B') },
  { matchNumber: 74, stage: 'r32', home: w('E'), away: third('E', ['A', 'B', 'C', 'D', 'F']) },
  { matchNumber: 75, stage: 'r32', home: w('F'), away: r('C') },
  { matchNumber: 76, stage: 'r32', home: w('C'), away: r('F') },
  { matchNumber: 77, stage: 'r32', home: w('I'), away: third('I', ['C', 'D', 'F', 'G', 'H']) },
  { matchNumber: 78, stage: 'r32', home: r('E'), away: r('I') },
  { matchNumber: 79, stage: 'r32', home: w('A'), away: third('A', ['C', 'E', 'F', 'H', 'I']) },
  { matchNumber: 80, stage: 'r32', home: w('L'), away: third('L', ['E', 'H', 'I', 'J', 'K']) },
  { matchNumber: 81, stage: 'r32', home: w('D'), away: third('D', ['B', 'E', 'F', 'I', 'J']) },
  { matchNumber: 82, stage: 'r32', home: w('G'), away: third('G', ['A', 'E', 'H', 'I', 'J']) },
  { matchNumber: 83, stage: 'r32', home: r('K'), away: r('L') },
  { matchNumber: 84, stage: 'r32', home: w('H'), away: r('J') },
  { matchNumber: 85, stage: 'r32', home: w('B'), away: third('B', ['E', 'F', 'G', 'I', 'J']) },
  { matchNumber: 86, stage: 'r32', home: w('J'), away: r('H') },
  { matchNumber: 87, stage: 'r32', home: w('K'), away: third('K', ['D', 'E', 'I', 'J', 'L']) },
  { matchNumber: 88, stage: 'r32', home: r('D'), away: r('G') },

  // Round of 16 (89-96).
  { matchNumber: 89, stage: 'r16', home: W(74), away: W(77) },
  { matchNumber: 90, stage: 'r16', home: W(73), away: W(75) },
  { matchNumber: 91, stage: 'r16', home: W(76), away: W(78) },
  { matchNumber: 92, stage: 'r16', home: W(79), away: W(80) },
  { matchNumber: 93, stage: 'r16', home: W(83), away: W(84) },
  { matchNumber: 94, stage: 'r16', home: W(81), away: W(82) },
  { matchNumber: 95, stage: 'r16', home: W(86), away: W(88) },
  { matchNumber: 96, stage: 'r16', home: W(85), away: W(87) },

  // Quarter-finals (97-100).
  { matchNumber: 97, stage: 'qf', home: W(89), away: W(90) },
  { matchNumber: 98, stage: 'qf', home: W(93), away: W(94) },
  { matchNumber: 99, stage: 'qf', home: W(91), away: W(92) },
  { matchNumber: 100, stage: 'qf', home: W(95), away: W(96) },

  // Semi-finals (101-102).
  { matchNumber: 101, stage: 'sf', home: W(97), away: W(98) },
  { matchNumber: 102, stage: 'sf', home: W(99), away: W(100) },

  // Third-place match (103) and Final (104).
  { matchNumber: 103, stage: 'third', home: L(101), away: L(102) },
  { matchNumber: 104, stage: 'final', home: W(101), away: W(102) },
];
