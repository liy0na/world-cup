import type { TeamStats } from '@wc/shared';
import { Flag } from '../lib/flags';
import { useI18n } from '../lib/i18n';
import { teamName } from '../lib/teamNames';
import type { TeamMap } from '../lib/teams';

interface Props {
  stats: TeamStats[];
  teams: TeamMap;
}

/** A small ranked list of teams by some metric. */
function Board({
  title,
  sub,
  rows,
  teams,
}: {
  title: string;
  sub: string;
  rows: { teamId: string; value: number }[];
  teams: TeamMap;
}) {
  const { lang, num } = useI18n();
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">{title}</h4>
        <span className="text-[10px] text-slate-600">{sub}</span>
      </div>
      <ul className="space-y-1">
        {rows.map(({ teamId, value }) => {
          const team = teams.get(teamId);
          return (
            <li key={teamId} className="flex items-center gap-2 text-sm">
              <Flag code={team?.code} />
              <span className="truncate text-slate-300">{teamName(team, lang) || teamId}</span>
              <span className="ms-auto font-semibold tabular-nums text-slate-100">{num(value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Tournament team records: attack, defence and discipline leaders. */
export function TeamRecords({ stats, teams }: Props) {
  const { t } = useI18n();
  const played = stats.filter((s) => s.played > 0);
  if (played.length === 0) return null;

  const top = (sort: (a: TeamStats, b: TeamStats) => number, value: (s: TeamStats) => number, n = 5) =>
    [...played]
      .sort(sort)
      .slice(0, n)
      .map((s) => ({ teamId: s.teamId, value: value(s) }));

  const cards = (s: TeamStats) => s.yellow + s.red * 2; // weight send-offs

  const mostGoals = top((a, b) => b.goalsFor - a.goalsFor || a.goalsAgainst - b.goalsAgainst, (s) => s.goalsFor);
  const cleanSheets = top(
    (a, b) => b.cleanSheets - a.cleanSheets || a.goalsAgainst - b.goalsAgainst,
    (s) => s.cleanSheets,
  );
  const fairPlay = top((a, b) => cards(a) - cards(b) || a.red - b.red, (s) => s.yellow + s.red);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/60">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">📊 {t('teamRecords')}</h3>
      </div>
      <div className="grid gap-4 p-3 sm:grid-cols-3">
        <Board title={t('recMostGoals')} sub="" rows={mostGoals} teams={teams} />
        <Board title={t('recCleanSheets')} sub={t('recCleanSheetsSub')} rows={cleanSheets} teams={teams} />
        <Board title={t('recFairPlay')} sub={t('recFairPlaySub')} rows={fairPlay} teams={teams} />
      </div>
    </div>
  );
}
