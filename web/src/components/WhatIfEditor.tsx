import type { Match } from '@wc/shared';
import { kickoffDay } from '../lib/format';
import { slotCode, slotName, type TeamMap } from '../lib/teams';

export type Draft = Record<string, { h: string; a: string }>;

interface Props {
  matches: Match[];
  teams: TeamMap;
  draft: Draft;
  committedCount: number;
  onChange: (draft: Draft) => void;
  onCalculate: () => void;
  onReset: () => void;
}

function ScoreInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-10 rounded-md border border-slate-700 bg-slate-950 px-1 py-0.5 text-center text-sm tabular-nums text-slate-100 focus:border-emerald-500 focus:outline-none"
    />
  );
}

export function WhatIfEditor({ matches, teams, draft, committedCount, onChange, onCalculate, onReset }: Props) {
  // Only group-stage fixtures that aren't finished can be hypothesised.
  const editable = matches
    .filter((m) => m.stage === 'group' && m.status !== 'finished' && m.group)
    .sort((a, b) => (a.group! < b.group! ? -1 : a.group! > b.group! ? 1 : Date.parse(a.kickoff) - Date.parse(b.kickoff)));

  const byGroup = new Map<string, Match[]>();
  for (const m of editable) {
    const list = byGroup.get(m.group!) ?? [];
    list.push(m);
    byGroup.set(m.group!, list);
  }

  const set = (id: string, side: 'h' | 'a', v: string) => {
    const cur = draft[id] ?? { h: '', a: '' };
    onChange({ ...draft, [id]: { ...cur, [side]: v } });
  };

  const filled = Object.values(draft).filter((d) => d.h !== '' && d.a !== '').length;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <h2 className="text-sm font-semibold text-slate-200">What-if calculator</h2>
        <p className="mt-1 text-xs text-slate-500">
          Enter scores for upcoming group games, then Calculate to recompute the tables, who qualifies,
          and the projected bracket from your hypothetical results. Leave a game blank to keep it open.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onCalculate}
            disabled={filled === 0}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Calculate ({filled})
          </button>
          {committedCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {editable.length === 0 ? (
        <p className="text-sm text-slate-500">No upcoming group games to project.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...byGroup.entries()].map(([group, list]) => (
            <div key={group} className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/60 text-sm font-semibold text-slate-200">
                Group {group}
              </div>
              <ul className="divide-y divide-slate-800/60">
                {list.map((m) => {
                  const d = draft[m.id] ?? { h: '', a: '' };
                  return (
                    <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="w-12 shrink-0 text-[10px] uppercase tracking-wider text-slate-600">
                        {kickoffDay(m.kickoff)}
                      </span>
                      <span className="flex-1 truncate text-right text-slate-200">
                        {slotName(m.home, teams)}{' '}
                        <span className="font-mono text-[10px] text-slate-500">{slotCode(m.home, teams)}</span>
                      </span>
                      <ScoreInput value={d.h} onChange={(v) => set(m.id, 'h', v)} />
                      <span className="text-slate-600">–</span>
                      <ScoreInput value={d.a} onChange={(v) => set(m.id, 'a', v)} />
                      <span className="flex-1 truncate text-slate-200">
                        <span className="font-mono text-[10px] text-slate-500">{slotCode(m.away, teams)}</span>{' '}
                        {slotName(m.away, teams)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
