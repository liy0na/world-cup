import type { ThirdPlaceRanking, TeamOdds } from '@wc/shared';
import { Flag } from '../lib/flags';
import { useI18n } from '../lib/i18n';
import { teamName } from '../lib/teamNames';
import type { TeamMap } from '../lib/teams';
import { OddsBar } from './OddsBar';

interface Props {
  ranking: ThirdPlaceRanking;
  teams: TeamMap;
  /** Advancement odds per team id (Monte-Carlo). Column is hidden when absent. */
  odds?: Record<string, TeamOdds>;
}

export function ThirdPlaceTable({ ranking, teams, odds }: Props) {
  const { t, lang, num } = useI18n();
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/60">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">
          {t('thirdPlaced')}
          <span className="mx-2 text-[11px] font-normal text-slate-500">{t('best8')}</span>
        </h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500">
            <th className="py-1.5 ps-3 text-start font-medium">#</th>
            <th className="py-1.5 text-start font-medium">{t('colGrp')}</th>
            <th className="py-1.5 text-start font-medium">{t('colTeam')}</th>
            <th className="py-1.5 px-1.5 text-end font-medium">Pts</th>
            <th className="py-1.5 px-1.5 text-end font-medium">GD</th>
            <th className="py-1.5 px-1.5 text-end font-medium">{t('colGF')}</th>
            {odds && (
              <th className="py-1.5 pe-3 ps-1.5 text-end font-medium" title={t('oddsColTitle')}>
                {t('oddsCol')}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {ranking.rows.map((row) => {
            const team = teams.get(row.teamId);
            return (
              <tr
                key={row.teamId}
                className={`border-t border-slate-800/60 ${row.qualifies ? 'bg-emerald-500/5' : 'opacity-55'}`}
              >
                <td className="py-1.5 ps-3">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] tabular-nums ${
                      row.qualifies ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {num(row.rank)}
                  </span>
                </td>
                <td className="py-1.5 text-slate-400 font-mono text-xs">{row.group}</td>
                <td className="py-1.5">
                  <span className="inline-flex items-center gap-2">
                    <Flag code={team?.code} />
                    <span className="font-mono text-[11px] text-slate-400">{team?.code ?? row.teamId}</span>
                    <span className="text-slate-200">{teamName(team, lang) || row.teamId}</span>
                  </span>
                </td>
                <td className="py-1.5 px-1.5 text-end tabular-nums font-semibold text-slate-100">{num(row.points)}</td>
                <td className="py-1.5 px-1.5 text-end tabular-nums text-slate-400">
                  <span dir="ltr">{num(row.gd > 0 ? `+${row.gd}` : String(row.gd))}</span>
                </td>
                <td className="py-1.5 px-1.5 text-end tabular-nums text-slate-400">{num(row.gf)}</td>
                {odds && (
                  <td className="py-1.5 pe-3 ps-1.5">
                    {odds[row.teamId] ? (
                      <OddsBar
                        value={odds[row.teamId]!.advance}
                        title={t('oddsBreakdown', {
                          w: num(Math.round(odds[row.teamId]!.winGroup * 100)),
                          t: num(Math.round(odds[row.teamId]!.topTwo * 100)),
                          b: num(Math.round(odds[row.teamId]!.bestThird * 100)),
                        })}
                        className="ms-auto w-12"
                      />
                    ) : (
                      <span className="block text-end text-slate-600">·</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
