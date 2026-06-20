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
    homeScore: match.HomeTeam?.Score ?? undefined,
    awayScore: match.AwayTeam?.Score ?? undefined,
    minute: parseMinute(match.MatchTime),
  };
}

/**
 * Unofficial FIFA API live overlay (free, no key). Returns the matches currently
 * in play. This is the project's only zero-cost source of true in-play scores
 * and is intentionally fragile-tolerant: on any error it yields no observations
 * and the backbone provider's data stands.
 */
export class FifaLiveProvider implements DataProvider {
  readonly name = 'fifa-live';
  constructor(private readonly base = 'https://api.fifa.com/api/v3') {}

  // The schedule comes from the backbone provider; this provider only overlays live.
  async loadSchedule(): Promise<Schedule> {
    return { teams: [], matches: [] };
  }

  async loadLive(): Promise<LiveObservation[]> {
    try {
      const res = await fetchJson<FifaLiveResponse>(`${this.base}/live/football/now`, {
        timeoutMs: 8_000,
      });
      const results = Array.isArray(res.Results) ? res.Results : [];
      return results
        .map(toObservation)
        .filter((o): o is LiveObservation => o !== undefined);
    } catch (err) {
      console.warn(`[fifa-live] live fetch failed (ignored): ${(err as Error).message}`);
      return [];
    }
  }
}
