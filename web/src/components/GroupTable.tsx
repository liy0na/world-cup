import type { GroupTable as GroupTableType, Qualification } from '@wc/shared';
import { Flag } from '../lib/flags';
import { useI18n } from '../lib/i18n';
import { outlookStyle } from '../lib/status';
import { teamName } from '../lib/teamNames';
import type { TeamMap } from '../lib/teams';

interface Props {
  table: GroupTableType;
  teams: TeamMap;
  qualification: Qualification;
}

// `wide` columns (GF, GA) are hidden on phones and shown from md up; the rest
// (P W D L GD Pts) are always visible. Auto layout sizes each number column to
// its content; the team cell (w-full max-w-0) absorbs the remaining width and
// truncates, so long names never push the Pts column off a narrow card.
const COLS = [
  ['P', 'played', false],
  ['W', 'won', false],
  ['D', 'drawn', false],
  ['L', 'lost', false],
  ['GF', 'gf', true],
  ['GA', 'ga', true],
  ['GD', 'gd', false],
  ['Pts', 'points', false],
] as const;

const WIDE = 'hidden md:table-cell';

export function GroupTable({ table, teams, qualification }: Props) {
  const { t, lang, num } = useI18n();
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/60">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">{t('group', { x: table.group })}</h3>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1 text-emerald-400">✓ {t('through')}</span>
          <span className="flex items-center gap-1 text-red-400">✗ {t('out')}</span>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500">
            <th className="py-1.5 ps-3 text-start font-medium">{t('colTeam')}</th>
            {COLS.map(([label, , wide]) => (
              <th key={label} className={`py-1.5 px-2 md:px-2.5 text-end font-medium tabular-nums ${wide ? WIDE : ''}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => {
            const team = teams.get(row.teamId);
            const status = qualification.byTeam[row.teamId];
            const style = outlookStyle(status?.outlook, row.rank);
            return (
              <tr key={row.teamId} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                <td className={`w-full max-w-0 py-1.5 ps-3 pe-2 border-s-2 ${style.accent}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-600 tabular-nums w-3 text-xs shrink-0">{num(row.rank)}</span>
                    <Flag code={team?.code} />
                    <span className="hidden font-mono text-[11px] text-slate-400 w-9 shrink-0 sm:inline">
                      {team?.code ?? row.teamId}
                    </span>
                    <span className="text-slate-200 truncate">{teamName(team, lang) || row.teamId}</span>
                    {style.marker && (
                      <span
                        className={`shrink-0 text-xs ${style.markerClass}`}
                        title={t(`outlook.${status?.outlook ?? 'alive'}`)}
                      >
                        {style.marker}
                      </span>
                    )}
                  </div>
                </td>
                {COLS.map(([label, key, wide]) => {
                  const text = num(key === 'gd' && row.gd > 0 ? `+${row.gd}` : String(row[key]));
                  return (
                    <td
                      key={label}
                      className={`py-1.5 px-2 md:px-2.5 text-end tabular-nums ${wide ? WIDE : ''} ${
                        label === 'Pts' ? 'font-semibold text-slate-100' : 'text-slate-400'
                      }`}
                    >
                      {/* dir=ltr keeps the +/- sign before the number in RTL (Persian). */}
                      {key === 'gd' ? <span dir="ltr">{text}</span> : text}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
