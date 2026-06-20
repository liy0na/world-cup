import { fetchJson } from '../util/fetchJson';
import type { DataProvider, LiveObservation, Schedule } from './provider';

// FIFA World Cup = competition 17; the 2026 edition = season 285023.
const WORLD_CUP_COMPETITION = '17';
const WORLD_CUP_SEASON_2026 = '285023';

// The live endpoint is deeply nested, localised and undocumented, so every
// field access below is defensive — any structural surprise yields no
// observations rather than throwing.
interface FifaLocalised {
  Locale?: string;
  Description?: string;
}
interface FifaTeam {
  IdTeam?: string;
  Score?: number | null;
  TeamName?: FifaLocalised[];
  ShortClubName?: string;
  Abbreviation?: string;
}
interface FifaMatch {
  IdCompetition?: string;
  IdSeason?: string;
  MatchStatus?: number;
  MatchTime?: string;
  // The live feed uses HomeTeam/AwayTeam (not Home/Away).
  HomeTeam?: FifaTeam | null;
  AwayTeam?: FifaTeam | null;
}
interface FifaLiveResponse {
  Results?: FifaMatch[];
}

// The calendar endpoint uses Home/Away (not HomeTeam/AwayTeam) and exposes a
// ResultType (1 = finished) plus penalty scores.
interface FifaCalendarMatch {
  IdCompetition?: string;
  IdSeason?: string;
  ResultType?: number;
  Home?: FifaTeam | null;
  Away?: FifaTeam | null;
  HomeTeamPenaltyScore?: number | null;
  AwayTeamPenaltyScore?: number | null;
}
interface FifaCalendarResponse {
  Results?: FifaCalendarMatch[];
}

function pickName(team: FifaTeam | null | undefined): string | undefined {
  if (!team) return undefined;
  const en = team.TeamName?.find((n) => n.Locale?.toLowerCase().startsWith('en')) ?? team.TeamName?.[0];
  return en?.Description ?? team.ShortClubName ?? team.Abbreviation;
}

function parseMinute(matchTime?: string): number | undefined {
  if (!matchTime) return undefined;
  const m = matchTime.match(/(\d{1,3})/);
  return m ? Number(m[1]) : undefined;
}

function toObservation(match: FifaMatch): LiveObservation | undefined {
  if (match.IdCompetition && match.IdCompetition !== WORLD_CUP_COMPETITION) return undefined;
  if (match.IdSeason && match.IdSeason !== WORLD_CUP_SEASON_2026) return undefined;
  const homeName = pickName(match.HomeTeam);
  const awayName = pickName(match.AwayTeam);
  if (!homeName || !awayName) return undefined;
  return {
    homeName,
    awayName,
    homeCode: match.HomeTeam?.Abbreviation,
    awayCode: match.AwayTeam?.Abbreviation,
    homeScore: match.HomeTeam?.Score ?? undefined,
    awayScore: match.AwayTeam?.Score ?? undefined,
    minute: parseMinute(match.MatchTime),
  };
}

/** Map a finished (ResultType === 1) calendar match to a result observation. */
function toResult(m: FifaCalendarMatch): LiveObservation | undefined {
  if (m.ResultType !== 1) return undefined; // finished only
  if (m.IdCompetition && m.IdCompetition !== WORLD_CUP_COMPETITION) return undefined;
  if (m.IdSeason && m.IdSeason !== WORLD_CUP_SEASON_2026) return undefined;
  const homeName = pickName(m.Home);
  const awayName = pickName(m.Away);
  const hs = m.Home?.Score;
  const as = m.Away?.Score;
  if (!homeName || !awayName || typeof hs !== 'number' || typeof as !== 'number') return undefined;
  const level = hs === as;
  const ph = m.HomeTeamPenaltyScore;
  const pa = m.AwayTeamPenaltyScore;
  return {
    homeName,
    awayName,
    homeCode: m.Home?.Abbreviation,
    awayCode: m.Away?.Abbreviation,
    homeScore: hs,
    awayScore: as,
    // Only attach penalties to a level match (a real shoot-out), not 0/0 fields on decided games.
    penaltyHome: level && typeof ph === 'number' ? ph : undefined,
    penaltyAway: level && typeof pa === 'number' ? pa : undefined,
    finished: true,
  };
}

/**
 * Unofficial FIFA API (free, no key). Provides both the in-play overlay
 * (/live/football/now) and finished results (/calendar/matches, ResultType=1),
 * so a game's result isn't lost when it leaves the live feed. Fragile-tolerant:
 * any error yields no observations and the backbone provider's data stands.
 */
export class FifaLiveProvider implements DataProvider {
  readonly name = 'fifa'; // supplies both live scores and finished results
  constructor(private readonly base = 'https://api.fifa.com/api/v3') {}

  // The schedule comes from the backbone provider; this provider only overlays results.
  async loadSchedule(): Promise<Schedule> {
    return { teams: [], matches: [] };
  }

  async loadLive(): Promise<LiveObservation[]> {
    try {
      const res = await fetchJson<FifaLiveResponse>(`${this.base}/live/football/now`, {
        timeoutMs: 8_000,
      });
      const results = Array.isArray(res.Results) ? res.Results : [];
      return results.map(toObservation).filter((o): o is LiveObservation => o !== undefined);
    } catch (err) {
      console.warn(`[fifa-live] live fetch failed (ignored): ${(err as Error).message}`);
      return [];
    }
  }

  async loadResults(): Promise<LiveObservation[]> {
    try {
      const url = `${this.base}/calendar/matches?idCompetition=${WORLD_CUP_COMPETITION}&idSeason=${WORLD_CUP_SEASON_2026}&count=500&language=en`;
      const res = await fetchJson<FifaCalendarResponse>(url, { timeoutMs: 12_000 });
      const results = Array.isArray(res.Results) ? res.Results : [];
      return results.map(toResult).filter((o): o is LiveObservation => o !== undefined);
    } catch (err) {
      console.warn(`[fifa-results] fetch failed (ignored): ${(err as Error).message}`);
      return [];
    }
  }
}
