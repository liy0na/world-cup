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

export interface Match {
  id: string;
  stage: Stage;
  /** Present for group-stage matches. */
  group?: GroupLetter;
  /** Official match number 1..104 (R32 = 73..88, ... final = 104). */
  matchNumber?: number;
  /** ISO-8601 kickoff in UTC. */
  kickoff: string;
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
  /** Knockout only: penalty-shootout score, used to decide a level match. */
  penalties?: { home: number; away: number };
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
  status?: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  afterExtraTime?: boolean;
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
}

export interface Qualification {
  byTeam: Record<string, TeamStatus>;
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
  source: {
    /** Active data provider name. */
    provider: string;
    /** Whether any match is currently live. */
    live: boolean;
  };
}
