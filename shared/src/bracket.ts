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
    status: actual?.status,
    homeScore: actual?.homeScore,
    awayScore: actual?.awayScore,
  };
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
