// Core domain model for the World Cup 2026 app. Shared verbatim by the server
// (which computes these) and the web UI (which renders them).

export const GROUP_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
] as const;
export type GroupLetter = (typeof GROUP_LETTERS)[number];

export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final';

export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface Team {
  /** Stable id we key everything on (we use the 3-letter code). */
  id: string;
  name: string;
  /** 3-letter code, e.g. "NED". */
  code: string;
  group: GroupLetter;
  /** FIFA World Ranking position (lower = better). Final tiebreaker fallback. */
  fifaRanking?: number;
}

/** Yellow/red tally used for the fair-play (disciplinary) tiebreaker. */
export interface CardTally {
  yellow: number;
  /** Second yellow leading to a red (counts as one indirect red). */
  doubleYellow: number;
  /** Straight red. */
  red: number;
}

/**
 * A reference to a competitor in a match slot. For group games this is a
 * resolved team. For knockout slots it may be an unresolved placeholder such
 * as "1A", "2B", "W73" (winner of match 73) or a third-place slot.
 */
export interface SlotRef {
  /** Symbolic source, e.g. "1A", "2B", "W73", "3rd". */
  source: string;
  /** Human label to show when unresolved, e.g. "Winner Group A", "3rd C/E/F/H/I". */
  label: string;
  /** Resolved team id, when known. */
  teamId?: string;
}

export type GoalKind = 'goal' | 'penalty' | 'own';

/** A single goal in a match, attributed to the team it counts for. */
export interface GoalEvent {
  /** Team id the goal counts FOR (an own goal counts for the opponent). */
  teamId: string;
  /** Scorer display name. */
  player: string;
  /** Stable scorer id from the source feed, for cross-match aggregation. */
  playerId?: string;
  /** Match minute, e.g. "23'" or "45'+2'". */
  minute: string;
  kind: GoalKind;
  /** Chronological order within the match (0-based), for stable display. */
  order: number;
}

/** A row in the top-scorers (Golden Boot) table. */
export interface TopScorer {
  /** 1-based rank; ties share a rank. */
  rank: number;
  playerId?: string;
  player: string;
  /** The scorer's team id. */
  teamId: string;
  /** Total goals credited (open play + penalties; own goals excluded). */
  goals: number;
  /** How many of those goals were penalties. */
  penalties: number;
  /** Matches the player appeared in (started or came on). */
  matchesPlayed: number;
}

/** A row in the top-assists table. */
export interface TopAssister {
  rank: number;
  playerId?: string;
  player: string;
  teamId: string;
  assists: number;
}

/** Per-team tournament tallies, for the records/leaderboards section. */
export interface TeamStats {
  teamId: string;
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Finished matches in which the team conceded zero. */
  cleanSheets: number;
  yellow: number;
  /** Red cards (second-yellow send-offs + straight reds). */
  red: number;
}

export interface Match {
  id: string;
  stage: Stage;
  /** Present for group-stage matches. */
  group?: GroupLetter;
  /** Official match number 1..104 (R32 = 73..88, ... final = 104). */
  matchNumber?: number;
  /** ISO-8601 kickoff in UTC. */
  kickoff: string;
  /** Host city / stadium from the schedule backbone (e.g. "Dallas"). */
  venue?: string;
  status: MatchStatus;
  /** Live clock minute, when status === "live". */
  minute?: number;
  home: SlotRef;
  away: SlotRef;
  homeScore?: number;
  awayScore?: number;
  homeCards?: CardTally;
  awayCards?: CardTally;
  /** Knockout only: score is after extra time (120'). Display/labeling. */
  afterExtraTime?: boolean;
  /** Knockout only: the 90' score, kept when extra time changed it (so the UI can show FT and AET). */
  fullTime?: { home: number; away: number };
  /** Knockout only: penalty-shootout score, used to decide a level match. */
  penalties?: { home: number; away: number };
  /** Goal events (scorers), when available from the live provider. */
  goals?: GoalEvent[];
  /** Assists, attributed to the assisting player's team. */
  assists?: AssistEvent[];
  /** Player ids who actually played (started or came on) — for games-played tallies. */
  lineup?: string[];
}

/** An assist in a match. */
export interface AssistEvent {
  teamId: string;
  player: string;
  playerId?: string;
  minute: string;
}

export interface StandingRow {
  teamId: string;
  /** 1..4 within the group once sorted. */
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  /** Disciplinary points (<= 0; higher/closer to 0 is better). */
  fairPlay: number;
}

export interface GroupTable {
  group: GroupLetter;
  rows: StandingRow[];
}

export interface ThirdPlaceRow {
  teamId: string;
  group: GroupLetter;
  /** 1..12 across all third-placed teams. */
  rank: number;
  /** True for the top 8 that advance to the Round of 32. */
  qualifies: boolean;
  points: number;
  gd: number;
  gf: number;
  fairPlay: number;
}

export interface ThirdPlaceRanking {
  rows: ThirdPlaceRow[];
  /** The (up to) 8 group letters whose third-placed team currently qualifies, sorted A..L. */
  qualifyingGroups: GroupLetter[];
}

export interface BracketMatch {
  matchNumber: number;
  stage: Exclude<Stage, 'group'>;
  home: SlotRef;
  away: SlotRef;
  /** Host city / stadium, when known from the schedule. */
  venue?: string;
  /** ISO-8601 kickoff in UTC, when known from the schedule. */
  kickoff?: string;
  status?: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  afterExtraTime?: boolean;
  /** The 90' score, kept when extra time changed it (so the UI can show FT and AET). */
  fullTime?: { home: number; away: number };
  penalties?: { home: number; away: number };
  /** Resolved winner/loser team ids once the match is decided (incl. penalties). */
  winnerTeamId?: string;
  loserTeamId?: string;
}

export interface Bracket {
  r32: BracketMatch[];
  r16: BracketMatch[];
  qf: BracketMatch[];
  sf: BracketMatch[];
  third: BracketMatch[];
  final: BracketMatch[];
}

export interface TournamentStatus {
  phase: 'group' | 'knockout' | 'complete';
  liveMatchCount: number;
  /** Current group-stage matchday (1..3), when in the group phase. */
  matchday?: number;
}

/**
 * A team's mathematically-certain qualification outlook, derived by enumerating
 * the outcomes of all remaining group matches. "Certain" means true in every
 * remaining scenario.
 */
export type TeamOutlook =
  | 'won_group' // clinched 1st in the group
  | 'advanced' // clinched a top-2 place
  | 'qualified_third' // clinched a best-8 third-place spot
  | 'eliminated' // cannot qualify by any route
  | 'alive'; // still in contention

/** Whether a given last-game result puts a team in the top 2: guaranteed / possible / impossible. */
export type NeedOutcome = 'in' | 'maybe' | 'out';

export interface TeamStatus {
  teamId: string;
  group: GroupLetter;
  outlook: TeamOutlook;
  /** Best (lowest) group finish still possible. */
  minRank: number;
  /** Worst (highest) group finish still possible. */
  maxRank: number;
  /** Set when the group finishing position is locked (minRank === maxRank). */
  clinchedRank?: number;
  /**
   * For a team with exactly one group game left: whether winning / drawing /
   * losing that game lands it in the top two (top-2 path only; the best-third
   * route is reflected by `outlook`).
   */
  ifWin?: NeedOutcome;
  ifDraw?: NeedOutcome;
  ifLoss?: NeedOutcome;
}

export interface Qualification {
  byTeam: Record<string, TeamStatus>;
}

export type MatchEventType = 'goal' | 'penalty' | 'own' | 'yellow' | 'red' | 'sub' | 'var' | 'other';

/** One entry in a match's play-by-play timeline. */
export interface MatchTimelineEntry {
  minute: string;
  type: MatchEventType;
  side?: 'home' | 'away';
  text: string;
}

export interface LineupPlayer {
  playerId: string;
  name: string;
  shirt?: number;
  starter: boolean;
}

/**
 * Rich, on-demand detail for a single match (lineups, timeline, venue, etc.),
 * fetched lazily when a match is opened — never part of the snapshot.
 */
export interface MatchDetail {
  matchId: string;
  homeTeamId?: string;
  awayTeamId?: string;
  venue?: string;
  city?: string;
  attendance?: number;
  referee?: string;
  possession?: { home: number; away: number };
  homeLineup: LineupPlayer[];
  awayLineup: LineupPlayer[];
  events: MatchTimelineEntry[];
}

/** The single payload the server caches and pushes to every browser. */
export interface Snapshot {
  generatedAt: string;
  status: TournamentStatus;
  teams: Team[];
  matches: Match[];
  groupTables: GroupTable[];
  thirdPlace: ThirdPlaceRanking;
  bracket: Bracket;
  qualification: Qualification;
  /** Top scorers across all matches (Golden Boot race). */
  topScorers: TopScorer[];
  /** Top assist providers across all matches. */
  topAssists: TopAssister[];
  /** Per-team tournament tallies for the records/leaderboards section. */
  teamStats: TeamStats[];
  source: {
    /** Active data provider name. */
    provider: string;
    /** Whether any match is currently live. */
    live: boolean;
  };
}
