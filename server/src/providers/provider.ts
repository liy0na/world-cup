import type { GroupLetter, Match, Team } from '@wc/shared';

export interface Schedule {
  teams: Team[];
  matches: Match[];
}

/**
 * A best-effort live observation keyed by team display names. The match store
 * resolves these against the backbone fixtures (by normalised name) so a flaky
 * or differently-spelled live feed can never corrupt the schedule.
 */
export interface LiveObservation {
  homeName: string;
  awayName: string;
  /** FIFA 3-letter codes (e.g. CIV) — the reliable join key across name spellings. */
  homeCode?: string;
  awayCode?: string;
  homeScore?: number;
  awayScore?: number;
  /** Penalty-shootout score (knockout), when the match was level. */
  penaltyHome?: number;
  penaltyAway?: number;
  minute?: number;
  finished?: boolean;
}

export interface DataProvider {
  readonly name: string;
  /** Static backbone: teams, groups, the full fixture list with any results so far. */
  loadSchedule(): Promise<Schedule>;
  /** Best-effort in-play overlay: matches currently live, with their current score. */
  loadLive?(): Promise<LiveObservation[]>;
  /** Finished matches with final scores (so results aren't lost when a game leaves the live feed). */
  loadResults?(): Promise<LiveObservation[]>;
}

/** FIFA 3-letter codes for the 48 finalists (used as stable team ids). */
export const TEAM_CODES: Record<string, string> = {
  Mexico: 'MEX',
  'South Africa': 'RSA',
  'South Korea': 'KOR',
  'Czech Republic': 'CZE',
  Canada: 'CAN',
  'Bosnia & Herzegovina': 'BIH',
  Qatar: 'QAT',
  Switzerland: 'SUI',
  Brazil: 'BRA',
  Morocco: 'MAR',
  Haiti: 'HAI',
  Scotland: 'SCO',
  USA: 'USA',
  Paraguay: 'PAR',
  Australia: 'AUS',
  Turkey: 'TUR',
  Germany: 'GER',
  'Curaçao': 'CUW',
  'Ivory Coast': 'CIV',
  Ecuador: 'ECU',
  Netherlands: 'NED',
  Japan: 'JPN',
  Sweden: 'SWE',
  Tunisia: 'TUN',
  Belgium: 'BEL',
  Egypt: 'EGY',
  Iran: 'IRN',
  'New Zealand': 'NZL',
  Spain: 'ESP',
  'Cape Verde': 'CPV',
  'Saudi Arabia': 'KSA',
  Uruguay: 'URU',
  France: 'FRA',
  Senegal: 'SEN',
  Iraq: 'IRQ',
  Norway: 'NOR',
  Argentina: 'ARG',
  Algeria: 'ALG',
  Austria: 'AUT',
  Jordan: 'JOR',
  Portugal: 'POR',
  'DR Congo': 'COD',
  Uzbekistan: 'UZB',
  Colombia: 'COL',
  England: 'ENG',
  Croatia: 'CRO',
  Ghana: 'GHA',
  Panama: 'PAN',
};

/** Preferred display names (FIFA-canonical) overriding the backbone's, keyed by team code. */
export const DISPLAY_NAMES: Record<string, string> = {
  CIV: "Côte d'Ivoire",
};

/** Normalise a team display name to a comparable key (diacritics/spacing-insensitive). */
export function normaliseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Stable team id from a display name: the FIFA code if known, else a derived code. */
export function teamId(name: string): string {
  return TEAM_CODES[name] ?? name.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
}

/** "Group A" -> "A". */
export function groupLetterFromName(name: string): GroupLetter | undefined {
  const m = name.match(/Group\s+([A-L])/i);
  return m ? (m[1]!.toUpperCase() as GroupLetter) : undefined;
}

/** Combine an openfootball date + "HH:MM UTC±H" time into an ISO-8601 UTC string. */
export function parseKickoff(date: string, time?: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  let hh = 0;
  let mm = 0;
  let offset = 0;
  if (time) {
    const tm = time.match(/(\d{1,2}):(\d{2})/);
    if (tm) {
      hh = Number(tm[1]);
      mm = Number(tm[2]);
    }
    const om = time.match(/UTC\s*([+-]\d{1,2})/i);
    if (om) offset = Number(om[1]);
  }
  // local = UTC + offset  =>  UTC = local - offset.
  const ms = Date.UTC(y!, (mo ?? 1) - 1, d ?? 1, hh - offset, mm);
  return new Date(ms).toISOString();
}

export const KO_ROUND_TO_STAGE: Record<string, Match['stage']> = {
  'Round of 32': 'r32',
  'Round of 16': 'r16',
  'Quarter-final': 'qf',
  'Quarter-finals': 'qf',
  'Semi-final': 'sf',
  'Semi-finals': 'sf',
  'Match for third place': 'third',
  'Third place': 'third',
  Final: 'final',
};
