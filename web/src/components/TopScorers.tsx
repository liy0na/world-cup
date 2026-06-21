import type { TopScorer } from '@wc/shared';
import { Flag } from '../lib/flags';
import { useI18n } from '../lib/i18n';
import type { TeamMap } from '../lib/teams';

interface Props {
  scorers: TopScorer[];
  teams: TeamMap;
}

/** Golden Boot leaderboard — the top scorers across the tournament. */
export function TopScorers({ scorers, teams }: Props) {
  const { t, num } = useI18n();
  const rows = scorers.slice(0, 15);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/60">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">
          ⚽ {t('topScorers')}
          <span className="mx-2 text-[11px] font-normal text-slate-500">{t('goldenBoot')}</span>
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-sm text-slate-500">{t('noScorers')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500">
              <th className="w-6 py-1.5 ps-3 text-start font-medium">#</th>
              <th className="py-1.5 text-start font-medium">{t('colPlayer')}</th>
              <th className="w-8 py-1.5 px-1 text-end font-medium tabular-nums" title={t('colMP')}>
                {t('colMP')}
              </th>
              <th className="w-8 py-1.5 px-1 text-end font-medium tabular-nums" title={t('colPenGoals')}>
                {t('colPenGoals')}
              </th>
              <th className="w-8 py-1.5 pe-3 text-end font-medium tabular-nums">{t('colGoals')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const team = teams.get(s.teamId);
              return (
                <tr key={s.playerId ?? `${s.teamId}:${s.player}`} className="border-t border-slate-800/60">
                  <td className="py-1.5 ps-3 text-xs tabular-nums text-slate-500">{num(s.rank)}</td>
                  <td className="py-1.5">
                    <span className="flex items-center gap-2 min-w-0">
                      <Flag code={team?.code} />
                      <span className="truncate text-slate-200">{s.player}</span>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0">{team?.code ?? s.teamId}</span>
                    </span>
                  </td>
                  <td className="py-1.5 px-1 text-end tabular-nums text-slate-400">{num(s.matchesPlayed)}</td>
                  <td className="py-1.5 px-1 text-end tabular-nums text-slate-500">{s.penalties > 0 ? num(s.penalties) : '–'}</td>
                  <td className="py-1.5 pe-3 text-end font-semibold tabular-nums text-slate-100">{num(s.goals)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
