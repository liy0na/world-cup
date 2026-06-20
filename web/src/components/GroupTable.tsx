import type { GroupLetter, GroupTable as GroupTableType } from '@wc/shared';
import type { TeamMap } from '../lib/teams';

interface Props {
  table: GroupTableType;
  teams: TeamMap;
  qualifyingThirds: Set<GroupLetter>;
}

const COLS = [
  ['P', 'played'],
  ['W', 'won'],
  ['D', 'drawn'],
  ['L', 'lost'],
  ['GD', 'gd'],
  ['Pts', 'points'],
] as const;

export function GroupTable({ table, teams, qualifyingThirds }: Props) {
  const thirdQualifies = qualifyingThirds.has(table.group);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/60">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">Group {table.group}</h3>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> top 2
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> 3rd
          </span>
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
            const team = teams.get(row.teamId);
            const top2 = row.rank <= 2;
            const isThird = row.rank === 3;
            const accent = top2
              ? 'border-emerald-500'
              : isThird && thirdQualifies
                ? 'border-amber-500'
                : isThird
                  ? 'border-amber-500/30'
                  : 'border-transparent';
            return (
              <tr
                key={row.teamId}
                className="border-t border-slate-800/60 hover:bg-slate-800/30"
              >
                <td className={`py-1.5 pl-3 border-l-2 ${accent}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 tabular-nums w-3 text-xs">{row.rank}</span>
                    <span className="font-mono text-[11px] text-slate-400 w-9">{team?.code ?? row.teamId}</span>
                    <span className="text-slate-200 truncate max-w-32">{team?.name ?? row.teamId}</span>
                  </div>
                </td>
                {COLS.map(([label, key]) => (
                  <td
                    key={label}
                    className={`py-1.5 px-1.5 text-right tabular-nums ${
                      label === 'Pts' ? 'font-semibold text-slate-100' : 'text-slate-400'
                    }`}
                  >
                    {key === 'gd' && row.gd > 0 ? `+${row.gd}` : row[key]}
                  </td>
                ))}
                <td className="w-2" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
