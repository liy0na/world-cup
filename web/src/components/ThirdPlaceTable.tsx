import type { ThirdPlaceRanking } from '@wc/shared';
import { Flag } from '../lib/flags';
import type { TeamMap } from '../lib/teams';

interface Props {
  ranking: ThirdPlaceRanking;
  teams: TeamMap;
}

export function ThirdPlaceTable({ ranking, teams }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/60">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">
          Third-placed teams
          <span className="ml-2 text-[11px] font-normal text-slate-500">best 8 advance</span>
        </h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500">
            <th className="py-1.5 pl-3 text-left font-medium">#</th>
            <th className="py-1.5 text-left font-medium">Grp</th>
            <th className="py-1.5 text-left font-medium">Team</th>
            <th className="py-1.5 px-1.5 text-right font-medium">Pts</th>
            <th className="py-1.5 px-1.5 text-right font-medium">GD</th>
            <th className="py-1.5 px-3 text-right font-medium">GF</th>
          </tr>
        </thead>
        <tbody>
          {ranking.rows.map((row) => {
            const team = teams.get(row.teamId);
            return (
              <tr
                key={row.teamId}
                className={`border-t border-slate-800/60 ${
                  row.qualifies ? 'bg-emerald-500/5' : 'opacity-55'
                }`}
              >
                <td className="py-1.5 pl-3">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] tabular-nums ${
                      row.qualifies
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {row.rank}
                  </span>
                </td>
                <td className="py-1.5 text-slate-400 font-mono text-xs">{row.group}</td>
                <td className="py-1.5">
                  <span className="inline-flex items-center gap-2">
                    <Flag code={team?.code} />
                    <span className="font-mono text-[11px] text-slate-400">{team?.code ?? row.teamId}</span>
                    <span className="text-slate-200">{team?.name ?? row.teamId}</span>
                  </span>
                </td>
                <td className="py-1.5 px-1.5 text-right tabular-nums font-semibold text-slate-100">{row.points}</td>
                <td className="py-1.5 px-1.5 text-right tabular-nums text-slate-400">
                  {row.gd > 0 ? `+${row.gd}` : row.gd}
                </td>
                <td className="py-1.5 px-3 text-right tabular-nums text-slate-400">{row.gf}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
