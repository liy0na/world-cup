import type { GroupTable, Match, Qualification, TeamStatus } from '@wc/shared';
import { Flag } from '../lib/flags';
import { useI18n } from '../lib/i18n';
import { teamName } from '../lib/teamNames';
import type { TeamMap } from '../lib/teams';
import { ScenarioGrid } from './ScenarioGrid';

interface Props {
  groupTables: GroupTable[];
  qualification: Qualification;
  teams: TeamMap;
  matches: Match[];
}

/** Pick the message describing what an alive team needs. */
function needKey(s: TeamStatus, remaining: number): string {
  if (remaining === 0) return 'need.await';
  if (remaining > 1 || !s.ifWin) return 'need.contention';
  if (s.ifDraw === 'in') return 'need.drawEnough';
  if (s.ifWin === 'in' && s.ifDraw === 'maybe') return 'need.winOrMaybeDraw';
  if (s.ifWin === 'in') return 'need.winOnly';
  if (s.ifWin === 'maybe') return 'need.winMaybe';
  return 'need.thirdRace';
}

const TONE: Record<string, string> = {
  'need.drawEnough': 'text-emerald-300',
  'need.winOrMaybeDraw': 'text-amber-300',
  'need.winOnly': 'text-amber-300',
  'need.winMaybe': 'text-amber-300',
  'need.thirdRace': 'text-slate-400',
  'need.await': 'text-slate-400',
  'need.contention': 'text-slate-400',
};

export function Scenarios({ groupTables, qualification, teams, matches }: Props) {
  const { t, lang } = useI18n();

  // Remaining group games per team.
  const remaining = new Map<string, number>();
  for (const m of matches) {
    if (m.stage !== 'group' || !(m.status === 'scheduled' || m.status === 'live')) continue;
    if (m.home.teamId) remaining.set(m.home.teamId, (remaining.get(m.home.teamId) ?? 0) + 1);
    if (m.away.teamId) remaining.set(m.away.teamId, (remaining.get(m.away.teamId) ?? 0) + 1);
  }

  // Groups that still have undecided (alive) teams, in standings order.
  const groups = groupTables
    .map((gt) => ({
      group: gt.group,
      alive: gt.rows.filter((r) => qualification.byTeam[r.teamId]?.outlook === 'alive'),
    }))
    .filter((g) => g.alive.length > 0);

  // Groups on their final matchday: exactly two group games left, spanning all
  // four teams — the only shape that fits the 2-D permutation grid.
  const openByGroup = new Map<string, Match[]>();
  for (const m of matches) {
    if (m.stage !== 'group' || !m.group) continue;
    if (!(m.status === 'scheduled' || m.status === 'live')) continue;
    if (!m.home.teamId || !m.away.teamId) continue;
    const list = openByGroup.get(m.group) ?? [];
    list.push(m);
    openByGroup.set(m.group, list);
  }
  const finalGroups = [...openByGroup.entries()]
    .filter(([, ms]) => ms.length === 2 && new Set(ms.flatMap((m) => [m.home.teamId!, m.away.teamId!])).size === 4)
    .map(([g]) => g)
    .sort();
  const leaderOf = (group: string) =>
    groupTables.find((gt) => gt.group === group)?.rows[0]?.teamId;

  if (groups.length === 0 && finalGroups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            {t('scenariosTitle')} <span className="font-normal normal-case text-slate-600">· {t('scenariosSubtitle')}</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map(({ group, alive }) => (
              <div key={group} className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/60 text-sm font-semibold text-slate-200">
                  {t('group', { x: group })}
                </div>
                <ul className="divide-y divide-slate-800/60">
                  {alive.map((row) => {
                    const team = teams.get(row.teamId);
                    const status = qualification.byTeam[row.teamId]!;
                    const key = needKey(status, remaining.get(row.teamId) ?? 0);
                    return (
                      <li key={row.teamId} className="flex items-start gap-2 px-3 py-2">
                        <Flag code={team?.code} className="mt-1" />
                        <span className="mt-0.5 shrink-0 font-mono text-[11px] text-slate-400">{team?.code ?? row.teamId}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-slate-200">{teamName(team, lang) || row.teamId}</div>
                          <p className={`mt-0.5 text-xs ${TONE[key]}`}>{t(key)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {finalGroups.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">
            {t('gridTitle')} <span className="font-normal normal-case text-slate-600">· {t('gridSubtitle')}</span>
          </h2>
          <p className="mb-3 max-w-3xl text-xs text-slate-500">{t('gridIntro')}</p>
          <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {finalGroups.map((group) => (
              <ScenarioGrid key={group} group={group} teams={teams} matches={matches} defaultFocal={leaderOf(group)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
