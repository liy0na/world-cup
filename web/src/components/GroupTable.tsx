import type { GroupTable as GroupTableType, Qualification } from '@wc/shared';
import { Flag } from '../lib/flags';
import { outlookStyle } from '../lib/status';
import type { TeamMap } from '../lib/teams';

interface Props {
  table: GroupTableType;
  teams: TeamMap;
  qualification: Qualification;
}

const COLS = [
  ['P', 'played'],
  ['W', 'won'],
  ['D', 'drawn'],
  ['L', 'lost'],
  ['GD', 'gd'],
  ['Pts', 'points'],
] as const;

export function GroupTable({ table, teams, qualification }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/60">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">Group {table.group}</h3>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1 text-emerald-400">✓ through</span>
          <span className="flex items-center gap-1 text-red-400">✗ out</span>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500">
            <th className="py-1.5 pl-3 text-left font-medium">Team</th>
            {COLS.map(([label]) => (
              <th key={label} className="py-1.5 px-1.5 text-right font-medium tabular-nums last:pr-3">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => {
            const t = teams.get(row.teamId);
            const status = qualification.byTeam[row.teamId];
            const style = outlookStyle(status?.outlook, row.rank);
            return (
              <tr key={row.teamId} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                <td className={`py-1.5 pl-3 border-l-2 ${style.accent}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 tabular-nums w-3 text-xs">{row.rank}</span>
                    <Flag code={t?.code} />
                    <span className="font-mono text-[11px] text-slate-400 w-9">{t?.code ?? row.teamId}</span>
                    <span className="text-slate-200 truncate max-w-28">{t?.name ?? row.teamId}</span>
                    {style.marker && (
                      <span className={`text-xs ${style.markerClass}`} title={style.label}>
                        {style.marker}
                      </span>
                    )}
                  </div>
                </td>
                {COLS.map(([label, key]) => (
                  <td
                    key={label}
                    className={`py-1.5 px-1.5 text-right tabular-nums last:pr-3 ${
                      label === 'Pts' ? 'font-semibold text-slate-100' : 'text-slate-400'
                    }`}
                  >
                    {key === 'gd' && row.gd > 0 ? `+${row.gd}` : row[key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
