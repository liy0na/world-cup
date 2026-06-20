import type { GroupLetter, Match, MatchStatus, SlotRef, Stage, Team } from '@wc/shared';
import { fetchJson } from '../util/fetchJson';
import groupsSeed from '../seed/worldcup.groups.json';
import scheduleSeed from '../seed/worldcup.json';
import {
  groupLetterFromName,
  KO_ROUND_TO_STAGE,
  parseKickoff,
  teamId,
  type DataProvider,
  type Schedule,
} from './provider';

interface OfMatch {
  round: string;
  num?: number;
  date: string;
  time?: string;
  team1: string;
  team2: string;
  score?: { ft?: [number, number]; ht?: [number, number] };
  ground?: string;
}
interface OfFile {
  name: string;
  matches: OfMatch[];
}
interface OfGroups {
  name: string;
  groups: { name: string; teams: string[] }[];
}

function stageOf(round: string, num?: number): Stage {
  if (/^Matchday/i.test(round)) return 'group';
  const mapped = KO_ROUND_TO_STAGE[round];
  if (mapped) return mapped;
  if (num == null) return 'group';
  if (num <= 72) return 'group';
  if (num <= 88) return 'r32';
  if (num <= 96) return 'r16';
  if (num <= 100) return 'qf';
  if (num <= 102) return 'sf';
  if (num === 103) return 'third';
  return 'final';
}

function buildTeams(groups: OfGroups): { teams: Team[]; nameToGroup: Map<string, GroupLetter> } {
  const teams: Team[] = [];
  const nameToGroup = new Map<string, GroupLetter>();
  for (const g of groups.groups) {
    const letter = groupLetterFromName(g.name);
    if (!letter) continue;
    for (const name of g.teams) {
      nameToGroup.set(name, letter);
      teams.push({ id: teamId(name), name, code: teamId(name), group: letter });
    }
  }
  return { teams, nameToGroup };
}

function toMatch(m: OfMatch, nameToGroup: Map<string, GroupLetter>): Match {
  const stage = stageOf(m.round, m.num);
  const ft = m.score?.ft;
  const status: MatchStatus = ft ? 'finished' : 'scheduled';

  const slot = (name: string): SlotRef => {
    const group = nameToGroup.get(name);
    return group
      ? { source: name, label: name, teamId: teamId(name) }
      : { source: name, label: name }; // knockout placeholder ("2A", "W101")
  };

  const group = stage === 'group' ? nameToGroup.get(m.team1) ?? nameToGroup.get(m.team2) : undefined;

  return {
    id: m.num != null ? `m${m.num}` : `${m.date}-${teamId(m.team1)}-${teamId(m.team2)}`,
    stage,
    group,
    matchNumber: m.num,
    kickoff: parseKickoff(m.date, m.time),
    status,
    home: slot(m.team1),
    away: slot(m.team2),
    homeScore: ft?.[0],
    awayScore: ft?.[1],
  };
}

function parse(groups: OfGroups, schedule: OfFile): Schedule {
  const { teams, nameToGroup } = buildTeams(groups);
  const matches = schedule.matches.map((m) => toMatch(m, nameToGroup));
  return { teams, matches };
}

/**
 * Free, key-less backbone provider. Pulls the full 104-match schedule, the 12
 * groups and finished results from openfootball; falls back to the bundled seed
 * (so the app renders offline / on first run before any successful fetch).
 */
export class OpenFootballProvider implements DataProvider {
  readonly name = 'openfootball';
  constructor(private readonly base: string) {}

  async loadSchedule(): Promise<Schedule> {
    try {
      const [groups, schedule] = await Promise.all([
        fetchJson<OfGroups>(`${this.base}/worldcup.groups.json`),
        fetchJson<OfFile>(`${this.base}/worldcup.json`),
      ]);
      return parse(groups, schedule);
    } catch (err) {
      console.warn(`[openfootball] live fetch failed, using bundled seed: ${(err as Error).message}`);
      return parse(groupsSeed as OfGroups, scheduleSeed as OfFile);
    }
  }
}
