import { buildBracket } from './bracket';
import { KNOCKOUT_MATCHES } from './data/bracketStructure';
import { DEFAULT_RATING, ELO_RATINGS } from './data/eloRatings';
import { sampleScore, type Rng } from './odds';
import { computeAllGroupTables } from './standings';
import { rankThirdPlacedTeams } from './thirds';
import type { BracketMatch, Match, Team } from './types';

/** How far a team got, as a share of simulated tournaments (0..1). */
export interface TeamTitleOdds {
  teamId: string;
  /** Reached the Round of 16 (won its Round-of-32 tie). */
  reachR16: number;
  /** Reached the quarter-finals. */
  reachQF: number;
  /** Reached the semi-finals. */
  reachSF: number;
  /** Reached the final. */
  reachFinal: number;
  /** Won the tournament. */
  champion: number;
}

export interface TitleOdds {
  byTeam: Record<string, TeamTitleOdds>;
  /** Simulations run (1 when the whole bracket is already decided). */
  iterations: number;
  /** False until the group stage is over and all 32 Round-of-32 teams are known. */
  ready: boolean;
}

const FINAL_MATCH = 104;
const THIRD_PLACE_MATCH = 103;

type ReachKey = Exclude<keyof TeamTitleOdds, 'teamId'>;

/** The round a match WINNER advances into (so we can tally it directly). */
function advanceKey(stage: BracketMatch['stage']): ReachKey | undefined {
  switch (stage) {
    case 'r32':
      return 'reachR16';
    case 'r16':
      return 'reachQF';
    case 'qf':
      return 'reachSF';
    case 'sf':
      return 'reachFinal';
    case 'final':
      return 'champion';
    default:
      return undefined; // the third-place match decides no title milestone
  }
}

// Static bracket wiring, derived once from the fixed structure.
const ADVANCE = new Map<number, ReachKey | undefined>(
  KNOCKOUT_MATCHES.map((d) => [d.matchNumber, advanceKey(d.stage)]),
);
const FEEDERS = new Map<number, { home?: number; away?: number }>(
  KNOCKOUT_MATCHES.map((d) => [
    d.matchNumber,
    {
      home: d.home.type === 'matchWinner' ? d.home.match : undefined,
      away: d.away.type === 'matchWinner' ? d.away.match : undefined,
    },
  ]),
);
// Every knockout match except the third-place play-off, in bracket order.
const ORDER = KNOCKOUT_MATCHES.map((d) => d.matchNumber)
  .filter((n) => n !== THIRD_PLACE_MATCH)
  .sort((a, b) => a - b);

function eloWinProb(rHome: number, rAway: number): number {
  return 1 / (1 + 10 ** ((rAway - rHome) / 400));
}

/**
 * Play one knockout tie to a single winner: sample a 90-minute scoreline from
 * the two Elo ratings (the same model the group sim uses); if level, resolve
 * the extra-time/penalties coin-flip with an Elo-weighted bias.
 */
function playTie(home: string, away: string, ratingOf: (id: string) => number, rng: Rng): string {
  const rh = ratingOf(home);
  const ra = ratingOf(away);
  const [hg, ag] = sampleScore(rh, ra, rng);
  if (hg > ag) return home;
  if (ag > hg) return away;
  return rng() < eloWinProb(rh, ra) ? home : away;
}

/**
 * Estimate each team's chance of reaching each knockout round — and of winning
 * the World Cup — by Monte-Carlo. Builds the current bracket (Round-of-32 teams
 * resolved from the final group tables, plus any knockout games already played),
 * then repeatedly plays every undecided tie forward to the final, sampling
 * scorelines from team-strength Elo ratings. Already-finished knockout games are
 * held fixed, so the odds tighten as the bracket fills in. The result is
 * deterministic (a single run) once the final is decided.
 */
export function simulateKnockout(
  teams: Team[],
  matches: Match[],
  opts: { iterations?: number; ratings?: Record<string, number>; rng?: Rng } = {},
): TitleOdds {
  const ratings = opts.ratings ?? ELO_RATINGS;
  const rng = opts.rng ?? Math.random;
  const ratingOf = (id: string) => ratings[id] ?? DEFAULT_RATING;

  const empty = (): Record<string, TeamTitleOdds> => {
    const o: Record<string, TeamTitleOdds> = {};
    for (const t of teams)
      o[t.id] = { teamId: t.id, reachR16: 0, reachQF: 0, reachSF: 0, reachFinal: 0, champion: 0 };
    return o;
  };

  const groupTables = computeAllGroupTables(teams, matches);
  const thirdPlace = rankThirdPlacedTeams(groupTables, teams);
  const koMatches = matches.filter((m) => m.stage !== 'group');
  const bracket = buildBracket(groupTables, thirdPlace, koMatches);

  const byNumber = new Map<number, BracketMatch>(
    [...bracket.r32, ...bracket.r16, ...bracket.qf, ...bracket.sf, ...bracket.third, ...bracket.final].map(
      (m) => [m.matchNumber, m],
    ),
  );

  // Title odds only mean something once the group stage is over and the
  // Round-of-32 line-up is locked (group tables resolve a 1st/2nd/3rd even
  // mid-group, so checking the slots alone is not enough). Until then,
  // report ready:false and the UI hides the panel.
  const groupMatches = matches.filter((m) => m.stage === 'group');
  const groupComplete = groupMatches.length > 0 && groupMatches.every((m) => m.status === 'finished');
  const r32Ready = bracket.r32.every((m) => m.home.teamId && m.away.teamId);
  if (!groupComplete || !r32Ready) return { byTeam: empty(), iterations: 0, ready: false };

  // If the final already has a winner the whole bracket is settled — one run.
  const decided = byNumber.get(FINAL_MATCH)?.winnerTeamId != null;
  const iterations = decided ? 1 : Math.max(1, opts.iterations ?? 10000);

  const tally = empty();
  for (let it = 0; it < iterations; it++) {
    const winnerOf = new Map<number, string>();
    for (const n of ORDER) {
      const m = byNumber.get(n)!;
      const home = n <= 88 ? m.home.teamId : winnerOf.get(FEEDERS.get(n)!.home!);
      const away = n <= 88 ? m.away.teamId : winnerOf.get(FEEDERS.get(n)!.away!);
      if (!home || !away) continue;
      const winner = m.winnerTeamId ?? playTie(home, away, ratingOf, rng);
      winnerOf.set(n, winner);
      const key = ADVANCE.get(n);
      if (key && tally[winner]) tally[winner][key] += 1;
    }
  }

  const byTeam: Record<string, TeamTitleOdds> = {};
  for (const t of teams) {
    const c = tally[t.id]!;
    byTeam[t.id] = {
      teamId: t.id,
      reachR16: c.reachR16 / iterations,
      reachQF: c.reachQF / iterations,
      reachSF: c.reachSF / iterations,
      reachFinal: c.reachFinal / iterations,
      champion: c.champion / iterations,
    };
  }
  return { byTeam, iterations, ready: true };
}
