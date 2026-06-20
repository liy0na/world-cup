import type {
  GroupLetter,
  GroupTable,
  Team,
  ThirdPlaceRanking,
  ThirdPlaceRow,
} from './types';

const QUALIFYING_THIRDS = 8;

function fifaRank(teamsById: Map<string, Team>, teamId: string): number {
  return teamsById.get(teamId)?.fifaRanking ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Rank the 12 third-placed teams in a single combined table and mark the top 8
 * as qualifying for the Round of 32. The cross-group ranking starts directly
 * with overall criteria (the thirds did not play each other):
 *   1) points  2) goal difference  3) goals scored
 *   4) fair-play points  5) FIFA World Ranking.
 */
export function rankThirdPlacedTeams(
  groupTables: GroupTable[],
  teams: Team[],
): ThirdPlaceRanking {
  const teamsById = new Map(teams.map((t) => [t.id, t]));

  const thirds: ThirdPlaceRow[] = [];
  for (const gt of groupTables) {
    const third = gt.rows.find((r) => r.rank === 3);
    if (!third) continue;
    thirds.push({
      teamId: third.teamId,
      group: gt.group,
      rank: 0,
      qualifies: false,
      points: third.points,
      gd: third.gd,
      gf: third.gf,
      fairPlay: third.fairPlay,
    });
  }

  thirds.sort(
    (a, b) =>
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      b.fairPlay - a.fairPlay ||
      fifaRank(teamsById, a.teamId) - fifaRank(teamsById, b.teamId),
  );

  thirds.forEach((row, i) => {
    row.rank = i + 1;
    row.qualifies = i < QUALIFYING_THIRDS;
  });

  const qualifyingGroups = thirds
    .filter((r) => r.qualifies)
    .map((r) => r.group)
    .sort() as GroupLetter[];

  return { rows: thirds, qualifyingGroups };
}
