import type { CardTally, LineupPlayer, MatchDetail, MatchEventType, MatchTimelineEntry } from '@wc/shared';
import { fetchJson } from '../util/fetchJson';
import type {
  DataProvider,
  LiveObservation,
  MatchEvents,
  MatchRef,
  ObservedAssist,
  ObservedGoal,
  Schedule,
} from './provider';

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
  IdStage?: string;
  IdMatch?: string;
  ResultType?: number;
  Home?: FifaTeam | null;
  Away?: FifaTeam | null;
  HomeTeamPenaltyScore?: number | null;
  AwayTeamPenaltyScore?: number | null;
}
interface FifaCalendarResponse {
  Results?: FifaCalendarMatch[];
}

// Match-detail endpoint: per-side Goals arrays (direct attribution) + lineups
// (to resolve a scorer's IdPlayer to a name).
interface FifaPlayer {
  IdPlayer?: string;
  PlayerName?: FifaLocalised[];
  ShortName?: FifaLocalised[];
  ShirtNumber?: number;
  /** 1 = starting XI, 2 = bench. */
  Status?: number;
}
interface FifaGoal {
  // 1 = penalty, 3 = own goal, anything else (typically 2) = normal goal.
  Type?: number;
  IdPlayer?: string;
  Minute?: string;
}
interface FifaSubstitution {
  IdPlayerOn?: string;
}
interface FifaBooking {
  // 1 = yellow, 2 = second yellow (indirect red), 3 = straight red.
  Card?: number;
  IdPlayer?: string;
  Minute?: string;
}
interface FifaTeamDetail {
  IdTeam?: string;
  Goals?: FifaGoal[] | null;
  Players?: FifaPlayer[] | null;
  Substitutions?: FifaSubstitution[] | null;
  Bookings?: FifaBooking[] | null;
}
interface FifaStadium {
  Name?: FifaLocalised[];
  CityName?: FifaLocalised[];
}
interface FifaOfficial {
  Name?: FifaLocalised[];
  NameShort?: FifaLocalised[];
  OfficialType?: number;
}
interface FifaMatchDetail {
  HomeTeam?: FifaTeamDetail | null;
  AwayTeam?: FifaTeamDetail | null;
  Stadium?: FifaStadium | null;
  Attendance?: number | string | null;
  Officials?: FifaOfficial[] | null;
  BallPossession?: { Home?: number; Away?: number; OverallHome?: number; OverallAway?: number } | null;
}

// Timeline endpoint: assists are only here (not on the goal objects).
interface FifaTimelineEvent {
  Type?: number;
  IdPlayer?: string;
  IdTeam?: string;
  MatchMinute?: string;
  EventDescription?: FifaLocalised[];
}
interface FifaTimeline {
  Event?: FifaTimelineEvent[];
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

function refOf(m: FifaCalendarMatch): MatchRef | undefined {
  if (m.IdCompetition && m.IdCompetition !== WORLD_CUP_COMPETITION) return undefined;
  if (m.IdSeason && m.IdSeason !== WORLD_CUP_SEASON_2026) return undefined;
  if (!m.IdStage || !m.IdMatch) return undefined;
  return {
    idStage: m.IdStage,
    idMatch: m.IdMatch,
    homeCode: m.Home?.Abbreviation,
    awayCode: m.Away?.Abbreviation,
    finished: m.ResultType === 1,
  };
}

function goalKind(type?: number): ObservedGoal['kind'] {
  return type === 1 ? 'penalty' : type === 3 ? 'own' : 'goal';
}

function pickEn(arr?: FifaLocalised[]): string | undefined {
  return arr?.find((n) => n.Locale?.toLowerCase().startsWith('en'))?.Description ?? arr?.[0]?.Description;
}

/** Map a FIFA timeline event type to a key event we surface in the match detail. */
function timelineType(type?: number): MatchEventType | undefined {
  switch (type) {
    case 0:
      return 'goal';
    case 41:
      return 'penalty';
    case 34:
      return 'own';
    case 2:
      return 'yellow';
    case 3:
      return 'red';
    case 5:
      return 'sub';
    case 71:
      return 'var';
    default:
      return undefined; // skip noise (fouls, attempts, throw-ins, …)
  }
}

/** Aggregate a side's bookings into a card tally (1=yellow, 2=2nd-yellow, 3=red). */
function cardTally(bookings: FifaBooking[] | null | undefined): CardTally {
  const t: CardTally = { yellow: 0, doubleYellow: 0, red: 0 };
  for (const b of bookings ?? []) {
    if (b.Card === 1) t.yellow += 1;
    else if (b.Card === 2) t.doubleYellow += 1;
    else if (b.Card === 3) t.red += 1;
  }
  return t;
}

/** "RAUL JIMENEZ" / "Raul JIMENEZ" -> "Raul Jimenez" (title-case ALL-CAPS tokens only). */
function tidyName(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 1 && w === w.toUpperCase() ? w.charAt(0) + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function playerName(p: FifaPlayer): string {
  const pick = (arr?: FifaLocalised[]) =>
    arr?.find((n) => n.Locale?.toLowerCase().startsWith('en'))?.Description ?? arr?.[0]?.Description;
  return tidyName(pick(p.ShortName) ?? pick(p.PlayerName) ?? '');
}

/** Sortable minute: "45'+2'" -> 45.02, "23'" -> 23. */
function minuteSort(min: string): number {
  const m = min.match(/(\d+)(?:\D*\+\s*(\d+))?/);
  if (!m) return 0;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0);
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
    return (await this.loadCalendar()).results;
  }

  /** One calendar pass: finished results + a ref for every match (used for goal fetches). */
  async loadCalendar(): Promise<{ results: LiveObservation[]; refs: MatchRef[] }> {
    try {
      const url = `${this.base}/calendar/matches?idCompetition=${WORLD_CUP_COMPETITION}&idSeason=${WORLD_CUP_SEASON_2026}&count=500&language=en`;
      const res = await fetchJson<FifaCalendarResponse>(url, { timeoutMs: 12_000 });
      const matches = Array.isArray(res.Results) ? res.Results : [];
      return {
        results: matches.map(toResult).filter((o): o is LiveObservation => o !== undefined),
        refs: matches.map(refOf).filter((r): r is MatchRef => r !== undefined),
      };
    } catch (err) {
      console.warn(`[fifa-results] fetch failed (ignored): ${(err as Error).message}`);
      return { results: [], refs: [] };
    }
  }

  /** Goals (ordered by minute), who played, cards and assists for one match. */
  async loadMatchGoals(ref: MatchRef): Promise<MatchEvents> {
    const detailUrl = `${this.base}/live/football/${WORLD_CUP_COMPETITION}/${WORLD_CUP_SEASON_2026}/${ref.idStage}/${ref.idMatch}?language=en`;
    const timelineUrl = `${this.base}/timelines/${WORLD_CUP_COMPETITION}/${WORLD_CUP_SEASON_2026}/${ref.idStage}/${ref.idMatch}?language=en`;
    const empty: CardTally = { yellow: 0, doubleYellow: 0, red: 0 };
    try {
      // Detail has goals/lineups/cards; the timeline is the only place assists live.
      const [d, tl] = await Promise.all([
        fetchJson<FifaMatchDetail>(detailUrl, { timeoutMs: 10_000 }),
        fetchJson<FifaTimeline>(timelineUrl, { timeoutMs: 10_000 }).catch(() => ({}) as FifaTimeline),
      ]);

      const names = new Map<string, string>();
      const lineup = new Set<string>();
      for (const side of [d.HomeTeam, d.AwayTeam]) {
        for (const p of side?.Players ?? []) {
          if (p.IdPlayer) names.set(p.IdPlayer, playerName(p));
          if (p.IdPlayer && p.Status === 1) lineup.add(p.IdPlayer); // starting XI
        }
        for (const s of side?.Substitutions ?? []) if (s.IdPlayerOn) lineup.add(s.IdPlayerOn); // came on
      }

      const collect = (side: 'home' | 'away', goals: FifaGoal[] | null | undefined) =>
        (goals ?? []).map((g) => ({
          side,
          kind: goalKind(g.Type),
          minute: g.Minute ?? '',
          player: (g.IdPlayer ? names.get(g.IdPlayer) : undefined) ?? '',
          playerId: g.IdPlayer,
          sort: minuteSort(g.Minute ?? ''),
        }));
      const all = [...collect('home', d.HomeTeam?.Goals), ...collect('away', d.AwayTeam?.Goals)];
      all.sort((a, b) => a.sort - b.sort);
      const goals: ObservedGoal[] = all.map(({ side, player, playerId, minute, kind }, order) => ({
        side,
        player,
        playerId,
        minute,
        kind,
        order,
      }));

      // Assists (timeline Type 1), oriented to home/away via the FIFA team id.
      const homeId = d.HomeTeam?.IdTeam;
      const awayId = d.AwayTeam?.IdTeam;
      const assists: ObservedAssist[] = [];
      for (const e of tl.Event ?? []) {
        if (e.Type !== 1) continue;
        const side = e.IdTeam === homeId ? 'home' : e.IdTeam === awayId ? 'away' : undefined;
        if (!side) continue;
        assists.push({
          side,
          playerId: e.IdPlayer,
          player: (e.IdPlayer ? names.get(e.IdPlayer) : undefined) ?? '',
          minute: e.MatchMinute ?? '',
        });
      }

      return {
        goals,
        lineup: [...lineup],
        homeCards: cardTally(d.HomeTeam?.Bookings),
        awayCards: cardTally(d.AwayTeam?.Bookings),
        assists,
      };
    } catch (err) {
      console.warn(`[fifa-goals] fetch failed (ignored): ${(err as Error).message}`);
      return { goals: [], lineup: [], homeCards: empty, awayCards: empty, assists: [] };
    }
  }

  /** Rich on-demand detail (lineups, key-event timeline, venue) for one match. */
  async loadMatchDetail(ref: MatchRef): Promise<MatchDetail> {
    const detailUrl = `${this.base}/live/football/${WORLD_CUP_COMPETITION}/${WORLD_CUP_SEASON_2026}/${ref.idStage}/${ref.idMatch}?language=en`;
    const timelineUrl = `${this.base}/timelines/${WORLD_CUP_COMPETITION}/${WORLD_CUP_SEASON_2026}/${ref.idStage}/${ref.idMatch}?language=en`;
    const [d, tl] = await Promise.all([
      fetchJson<FifaMatchDetail>(detailUrl, { timeoutMs: 10_000 }),
      fetchJson<FifaTimeline>(timelineUrl, { timeoutMs: 10_000 }).catch(() => ({}) as FifaTimeline),
    ]);

    const lineupOf = (side: FifaTeamDetail | null | undefined): LineupPlayer[] => {
      const onIds = new Set((side?.Substitutions ?? []).map((s) => s.IdPlayerOn).filter(Boolean) as string[]);
      return (side?.Players ?? [])
        .filter((p) => p.IdPlayer && (p.Status === 1 || onIds.has(p.IdPlayer)))
        .map((p) => ({ playerId: p.IdPlayer!, name: playerName(p), shirt: p.ShirtNumber, starter: p.Status === 1 }))
        .sort((a, b) => Number(b.starter) - Number(a.starter) || (a.shirt ?? 99) - (b.shirt ?? 99));
    };

    const homeId = d.HomeTeam?.IdTeam;
    const awayId = d.AwayTeam?.IdTeam;
    const events: MatchTimelineEntry[] = [];
    for (const e of tl.Event ?? []) {
      const type = timelineType(e.Type);
      if (!type) continue;
      const side = e.IdTeam === homeId ? 'home' : e.IdTeam === awayId ? 'away' : undefined;
      events.push({ minute: e.MatchMinute ?? '', type, side, text: pickEn(e.EventDescription) ?? '' });
    }

    const referee = (d.Officials ?? []).find((o) => o.OfficialType === 1);
    const poss = d.BallPossession;
    const home = poss?.Home ?? poss?.OverallHome;
    const away = poss?.Away ?? poss?.OverallAway;
    const possession =
      typeof home === 'number' && typeof away === 'number' ? { home: Math.round(home), away: Math.round(away) } : undefined;

    return {
      matchId: '', // filled in by the caller, which knows our fixture id
      homeTeamId: ref.homeCode,
      awayTeamId: ref.awayCode,
      venue: pickEn(d.Stadium?.Name),
      city: pickEn(d.Stadium?.CityName),
      attendance: typeof d.Attendance === 'number' ? d.Attendance : Number(d.Attendance) || undefined,
      referee: pickEn(referee?.Name) ?? pickEn(referee?.NameShort),
      possession,
      homeLineup: lineupOf(d.HomeTeam),
      awayLineup: lineupOf(d.AwayTeam),
      events,
    };
  }
}
