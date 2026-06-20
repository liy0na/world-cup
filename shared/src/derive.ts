import { buildBracket } from './bracket';
import { computeQualification } from './qualification';
import { computeAllGroupTables } from './standings';
import { rankThirdPlacedTeams } from './thirds';
import type { Bracket, GroupTable, Match, Qualification, Team, ThirdPlaceRanking } from './types';

export interface DerivedStandings {
  groupTables: GroupTable[];
  thirdPlace: ThirdPlaceRanking;
  bracket: Bracket;
  qualification: Qualification;
}

/**
 * Compute everything derived from teams + matches: group tables, the
 * third-place ranking, the projected bracket and the qualification outlook.
 * Pure — runs identically on the server (live snapshot) and in the browser
 * (what-if recomputation).
 */
export function computeStandings(teams: Team[], matches: Match[]): DerivedStandings {
  const groupTables = computeAllGroupTables(teams, matches);
  const thirdPlace = rankThirdPlacedTeams(groupTables, teams);
  const koMatches = matches.filter((m) => m.stage !== 'group');
  const bracket = buildBracket(groupTables, thirdPlace, koMatches);
  const qualification = computeQualification(teams, matches);
  return { groupTables, thirdPlace, bracket, qualification };
}
