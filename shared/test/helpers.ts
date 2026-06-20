import type { CardTally, GroupLetter, GroupTable, Match, StandingRow, Team } from '../src/types';

let counter = 0;

export function team(id: string, group: GroupLetter, fifaRanking?: number): Team {
  return { id, name: id, code: id.slice(0, 3).toUpperCase(), group, fifaRanking };
}

export interface ResultOpts {
  status?: Match['status'];
  homeCards?: CardTally;
  awayCards?: CardTally;
}

/** A finished group match between two team ids with the given score. */
export function result(
  group: GroupLetter,
  homeId: string,
  awayId: string,
  homeScore: number,
  awayScore: number,
  opts: ResultOpts = {},
): Match {
  return {
    id: `m${counter++}`,
    stage: 'group',
    group,
    kickoff: '2026-06-12T00:00:00Z',
    status: opts.status ?? 'finished',
    home: { source: homeId, label: homeId, teamId: homeId },
    away: { source: awayId, label: awayId, teamId: awayId },
    homeScore,
    awayScore,
    homeCards: opts.homeCards,
    awayCards: opts.awayCards,
  };
}

export const cards = (yellow = 0, doubleYellow = 0, red = 0): CardTally => ({
  yellow,
  doubleYellow,
  red,
});

/** Build a fully-ranked GroupTable from teams already in finishing order. */
export function tableInOrder(group: GroupLetter, orderedTeamIds: string[]): GroupTable {
  const rows: StandingRow[] = orderedTeamIds.map((teamId, i) => ({
    teamId,
    rank: i + 1,
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: (orderedTeamIds.length - i) * 3,
    fairPlay: 0,
  }));
  return { group, rows };
}
