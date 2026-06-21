import type { Match, TeamStats } from './types';

/**
 * Per-team tournament tallies (goals, clean sheets, cards) across all finished
 * or in-play matches. The UI slices these into records/leaderboards. Cards come
 * from the match card tallies when available.
 */
export function computeTeamStats(matches: Match[]): TeamStats[] {
  const acc = new Map<string, TeamStats>();
  const get = (teamId: string): TeamStats => {
    let s = acc.get(teamId);
    if (!s) {
      s = { teamId, played: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0, yellow: 0, red: 0 };
      acc.set(teamId, s);
    }
    return s;
  };

  for (const m of matches) {
    if (m.status !== 'finished' && m.status !== 'live') continue;
    if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') continue;
    const h = m.home.teamId;
    const a = m.away.teamId;
    if (!h || !a) continue;

    const home = get(h);
    const away = get(a);
    home.played += 1;
    away.played += 1;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;
    if (m.status === 'finished' && m.awayScore === 0) home.cleanSheets += 1;
    if (m.status === 'finished' && m.homeScore === 0) away.cleanSheets += 1;
    if (m.homeCards) {
      home.yellow += m.homeCards.yellow;
      home.red += m.homeCards.doubleYellow + m.homeCards.red;
    }
    if (m.awayCards) {
      away.yellow += m.awayCards.yellow;
      away.red += m.awayCards.doubleYellow + m.awayCards.red;
    }
  }

  return [...acc.values()];
}
