import { useMemo, useState } from 'react';
import type { GroupLetter } from '@wc/shared';
import { Bracket } from './components/Bracket';
import { GroupTable } from './components/GroupTable';
import { LiveScores } from './components/LiveScores';
import { ThirdPlaceTable } from './components/ThirdPlaceTable';
import { useLiveState, type ConnectionStatus } from './hooks/useLiveState';
import { timeAgo } from './lib/format';
import { teamMap } from './lib/teams';

const CONNECTION: Record<ConnectionStatus, { color: string; label: string }> = {
  live: { color: 'bg-emerald-500', label: 'Live' },
  polling: { color: 'bg-amber-500', label: 'Polling' },
  connecting: { color: 'bg-slate-500', label: 'Connecting' },
  offline: { color: 'bg-red-500', label: 'Offline' },
};

type Tab = 'groups' | 'bracket';

export function App() {
  const { snapshot, status } = useLiveState();
  const [tab, setTab] = useState<Tab>('groups');

  const teams = useMemo(() => (snapshot ? teamMap(snapshot) : new Map()), [snapshot]);
  const qualifyingThirds = useMemo(
    () => new Set<GroupLetter>(snapshot?.thirdPlace.qualifyingGroups ?? []),
    [snapshot],
  );

  const conn = CONNECTION[status];
  const phaseLabel = snapshot
    ? snapshot.status.phase === 'group'
      ? `Group stage · Matchday ${snapshot.status.matchday ?? '–'}`
      : snapshot.status.phase === 'knockout'
        ? 'Knockout stage'
        : 'Complete'
    : '…';

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-[#0a0e16]/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h1 className="text-lg font-bold tracking-tight text-white">World Cup 2026</h1>
              <span className="text-xs text-slate-400">{phaseLabel}</span>
              {snapshot && snapshot.status.liveMatchCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-red-500" />
                  {snapshot.status.liveMatchCount} live
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {snapshot && <span>updated {timeAgo(snapshot.generatedAt)}</span>}
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${conn.color}`} />
                {conn.label}
              </span>
            </div>
          </div>
          <nav className="mt-3 flex gap-1">
            {(['groups', 'bracket'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'groups' ? 'Groups & tables' : 'Projected bracket'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 space-y-6">
        {!snapshot ? (
          <div className="py-20 text-center text-slate-500">Loading the tournament…</div>
        ) : (
          <>
            <LiveScores matches={snapshot.matches} teams={teams} />

            {tab === 'groups' ? (
              <>
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {snapshot.groupTables.map((table) => (
                    <GroupTable
                      key={table.group}
                      table={table}
                      teams={teams}
                      qualifyingThirds={qualifyingThirds}
                    />
                  ))}
                </section>
                <section className="max-w-2xl">
                  <ThirdPlaceTable ranking={snapshot.thirdPlace} teams={teams} />
                </section>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Projected matchups <span className="text-slate-400">as it stands</span> — group
                  winners/runners-up are this moment's standings and the eight best third-placed teams
                  are slotted via FIFA's official combination table. Fixed once the group stage ends.
                </p>
                <Bracket bracket={snapshot.bracket} teams={teams} />
              </>
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-600">
        <p>
          Standings & bracket computed live from match results · source:{' '}
          {snapshot?.source.provider ?? '—'}. Not affiliated with FIFA.
        </p>
      </footer>
    </div>
  );
}
