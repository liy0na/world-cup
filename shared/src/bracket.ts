import {
  KNOCKOUT_MATCHES,
  type KoMatchDef,
  type KoSlotSource,
} from './data/bracketStructure';
import { THIRD_PLACE_COMBINATIONS } from './data/thirdPlaceCombinations';
import type {
  Bracket,
  BracketMatch,
  GroupLetter,
  GroupTable,
  Match,
  SlotRef,
  ThirdPlaceRanking,
} from './types';

interface BuildContext {
  tablesByGroup: Map<GroupLetter, GroupTable>;
  /** winner-column -> third-place group letter, from the combination table. */
  thirdAssignment: Map<GroupLetter, GroupLetter>;
  /** Actual knockout-stage matches keyed by match number (scores, status). */
  koMatchesByNumber: Map<number, Match>;
}

function teamAtRank(table: GroupTable | undefined, rank: number): string | undefined {
  return table?.rows.find((r) => r.rank === rank)?.teamId;
}

function resolveSlot(source: KoSlotSource, ctx: BuildContext): SlotRef {
  switch (source.type) {
    case 'winner':
      return {
        source: `1${source.group}`,
        label: `Winner ${source.group}`,
        teamId: teamAtRank(ctx.tablesByGroup.get(source.group), 1),
      };
    case 'runnerup':
      return {
        source: `2${source.group}`,
        label: `Runner-up ${source.group}`,
        teamId: teamAtRank(ctx.tablesByGroup.get(source.group), 2),
      };
    case 'third': {
      const group = ctx.thirdAssignment.get(source.winnerColumn);
      return {
        source: `3rd(${source.winnerColumn})`,
        label: group ? `3rd ${group}` : `3rd ${source.allowed.join('/')}`,
        teamId: group ? teamAtRank(ctx.tablesByGroup.get(group), 3) : undefined,
      };
    }
    case 'matchWinner':
      return { source: `W${source.match}`, label: `Winner M${source.match}` };
    case 'matchLoser':
      return { source: `L${source.match}`, label: `Loser M${source.match}` };
  }
}

function toBracketMatch(def: KoMatchDef, ctx: BuildContext): BracketMatch {
  const actual = ctx.koMatchesByNumber.get(def.matchNumber);
  return {
    matchNumber: def.matchNumber,
    stage: def.stage,
    home: resolveSlot(def.home, ctx),
    away: resolveSlot(def.away, ctx),
    venue: actual?.venue,
    kickoff: actual?.kickoff,
    status: actual?.status,
    homeScore: actual?.homeScore,
    awayScore: actual?.awayScore,
    afterExtraTime: actual?.afterExtraTime,
    fullTime: actual?.fullTime,
    penalties: actual?.penalties,
  };
}

/** Where each match's winner ("W##") and loser ("L##") flow to in a later round. */
interface Ref {
  token: string;
  toMatch: number;
  side: 'home' | 'away';
}
const REFS: Ref[] = KNOCKOUT_MATCHES.flatMap((def) =>
  (['home', 'away'] as const).flatMap((side) => {
    const src = def[side];
    if (src.type === 'matchWinner') return [{ token: `W${src.match}`, toMatch: def.matchNumber, side }];
    if (src.type === 'matchLoser') return [{ token: `L${src.match}`, toMatch: def.matchNumber, side }];
    return [];
  }),
);

/** Decide a knockout match: higher score wins; if level, the penalty score decides. */
function decide(m: BracketMatch): { winner?: string; loser?: string } {
  const h = m.home.teamId;
  const a = m.away.teamId;
  if (!h || !a || m.status !== 'finished' || typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') {
    return {};
  }
  if (m.homeScore > m.awayScore) return { winner: h, loser: a };
  if (m.awayScore > m.homeScore) return { winner: a, loser: h };
  const p = m.penalties;
  if (p && p.home !== p.away) return p.home > p.away ? { winner: h, loser: a } : { winner: a, loser: h };
  return {}; // level and no penalty result yet
}

/**
 * Walk the bracket in match order, decide each finished match (extra time /
 * penalties included) and flow the winner — and, for the third-place match, the
 * loser — into the slot that references it in a later round.
 */
function propagateWinners(byNumber: Map<number, BracketMatch>): void {
  for (const m of [...byNumber.values()].sort((x, y) => x.matchNumber - y.matchNumber)) {
    const { winner, loser } = decide(m);
    m.winnerTeamId = winner;
    m.loserTeamId = loser;
    for (const ref of REFS) {
      if (ref.token === `W${m.matchNumber}` && winner) byNumber.get(ref.toMatch)![ref.side].teamId = winner;
      if (ref.token === `L${m.matchNumber}` && loser) byNumber.get(ref.toMatch)![ref.side].teamId = loser;
    }
  }
}

/**
 * Build the projected knockout bracket "as it stands". Group winners/runners-up
 * resolve to the current 1st/2nd of each group; the eight best-third slots are
 * filled by looking up FIFA's official combination table with the eight
 * currently-qualifying third-placed groups. Later-round slots stay as
 * "Winner M##" placeholders until results exist. Any real knockout match data
 * (scores/status) is overlaid by match number.
 */
export function buildBracket(
  groupTables: GroupTable[],
  thirdPlace: ThirdPlaceRanking,
  koMatches: Match[] = [],
): Bracket {
  const ctx: BuildContext = {
    tablesByGroup: new Map(groupTables.map((t) => [t.group, t])),
    thirdAssignment: new Map(),
    koMatchesByNumber: new Map(
      koMatches
        .filter((m) => typeof m.matchNumber === 'number')
        .map((m) => [m.matchNumber as number, m]),
    ),
  };

  // The combination table is keyed by the eight qualifying groups, sorted A..L.
  const key = [...thirdPlace.qualifyingGroups].sort().join('');
  const assignment = THIRD_PLACE_COMBINATIONS[key];
  if (assignment) {
    for (const [winnerCol, thirdGroup] of Object.entries(assignment)) {
      ctx.thirdAssignment.set(winnerCol as GroupLetter, thirdGroup as GroupLetter);
    }
  }

  const matches = KNOCKOUT_MATCHES.map((def) => toBracketMatch(def, ctx));

  // Flow decided results forward: R32 winners into the R16, and so on up to the
  // final, plus the semi-final losers into the third-place match.
  propagateWinners(new Map(matches.map((m) => [m.matchNumber, m])));

  const byStage = (stage: BracketMatch['stage']) =>
    matches.filter((m) => m.stage === stage);

  return {
    r32: byStage('r32'),
    r16: byStage('r16'),
    qf: byStage('qf'),
    sf: byStage('sf'),
    third: byStage('third'),
    final: byStage('final'),
  };
}
