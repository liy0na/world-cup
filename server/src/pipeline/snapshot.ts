import {
  computeStandings,
  computeTeamStats,
  computeTopAssists,
  computeTopScorers,
  type Match,
  type Snapshot,
  type Team,
  type TournamentStatus,
} from '@wc/shared';

const GROUP_MATCH_TOTAL = 72;
const FINAL_MATCH_NUMBER = 104;

function tournamentStatus(matches: Match[], groupPlayedMax: number): TournamentStatus {
  const liveMatchCount = matches.filter((m) => m.status === 'live').length;
  const groupFinished = matches.filter((m) => m.stage === 'group' && m.status === 'finished').length;
  const finalDone = matches.some(
    (m) => m.matchNumber === FINAL_MATCH_NUMBER && m.status === 'finished',
  );

  let phase: TournamentStatus['phase'] = 'group';
  if (finalDone) phase = 'complete';
  else if (groupFinished >= GROUP_MATCH_TOTAL) phase = 'knockout';

  return {
    phase,
    liveMatchCount,
    matchday: phase === 'group' ? Math.min(3, Math.max(1, groupPlayedMax)) : undefined,
  };
}

/** Compute the full snapshot (tables, third-place ranking, projected bracket, qualification). */
export function buildSnapshot(teams: Team[], matches: Match[], provider: string): Snapshot {
  const { groupTables, thirdPlace, bracket, qualification } = computeStandings(teams, matches);

  const groupPlayedMax = Math.max(
    0,
    ...groupTables.flatMap((t) => t.rows.map((r) => r.played)),
  );

  return {
    generatedAt: new Date().toISOString(),
    status: tournamentStatus(matches, groupPlayedMax),
    teams,
    matches,
    groupTables,
    thirdPlace,
    bracket,
    qualification,
    topScorers: computeTopScorers(matches),
    topAssists: computeTopAssists(matches),
    teamStats: computeTeamStats(matches),
    source: {
      provider,
      live: matches.some((m) => m.status === 'live'),
    },
  };
}
