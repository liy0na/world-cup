import { useMemo, useState } from 'react';
import { computeStandings, type Match, type Snapshot } from '@wc/shared';
import { Bracket, type KoResult } from './components/Bracket';
import { GroupTable } from './components/GroupTable';
import { LiveScores } from './components/LiveScores';
import { ThirdPlaceTable } from './components/ThirdPlaceTable';
import { WhatIfEditor, type Draft } from './components/WhatIfEditor';
import { useLiveState, type ConnectionStatus } from './hooks/useLiveState';
import { timeAgo } from './lib/format';
import { teamMap } from './lib/teams';

const CONNECTION: Record<ConnectionStatus, { color: string; label: string }> = {
  live: { color: 'bg-emerald-500', label: 'Live' },
  polling: { color: 'bg-amber-500', label: 'Polling' },
  connecting: { color: 'bg-slate-500', label: 'Connecting' },
  offline: { color: 'bg-red-500', label: 'Offline' },
};

type Tab = 'groups' | 'bracket' | 'whatif';
type Scenario = Record<string, KoResult>;

/** Merge hypothetical group + knockout results over the real fixtures and recompute. */
function applyScenario(snapshot: Snapshot, scenario: Scenario): Snapshot {
  if (Object.keys(scenario).length === 0) return snapshot;
  const matches: Match[] = snapshot.matches.map((m) => {
    const w = scenario[m.id];
    if (!w || typeof w.h !== 'number' || typeof w.a !== 'number') return m; // unset / partial
    return {
      ...m,
      status: 'finished',
      homeScore: w.h,
      awayScore: w.a,
      afterExtraTime: w.et,
      penalties: typeof w.penH === 'number' && typeof w.penA === 'number' ? { home: w.penH, away: w.penA } : undefined,
    };
  });
  return { ...snapshot, matches, ...computeStandings(snapshot.teams, matches) };
}

export function App() {
  const { snapshot, status } = useLiveState();
  const [tab, setTab] = useState<Tab>('groups');
  const [draft, setDraft] = useState<Draft>({});
  const [groupWhatIf, setGroupWhatIf] = useState<Scenario>({}); // committed via Calculate
  const [koResults, setKoResults] = useState<Scenario>({}); // applied immediately
  const [bracketEdit, setBracketEdit] = useState(false);

  const scenario = useMemo(() => ({ ...groupWhatIf, ...koResults }), [groupWhatIf, koResults]);
  const view = useMemo(() => (snapshot ? applyScenario(snapshot, scenario) : undefined), [snapshot, scenario]);
  const teams = useMemo(() => (view ? teamMap(view) : new Map()), [view]);

  const scenarioCount = Object.keys(scenario).length;
  const conn = CONNECTION[status];
  const phaseLabel = view
    ? view.status.phase === 'group'
      ? `Group stage · Matchday ${view.status.matchday ?? '–'}`
      : view.status.phase === 'knockout'
        ? 'Knockout stage'
        : 'Complete'
    : '…';

  const calculate = () => {
    const next: Scenario = {};
    for (const [id, d] of Object.entries(draft)) {
      const h = Number(d.h);
      const a = Number(d.a);
      if (d.h !== '' && d.a !== '' && Number.isFinite(h) && Number.isFinite(a) && h >= 0 && a >= 0) {
        next[id] = { h, a };
      }
    }
    setGroupWhatIf(next);
    setTab('groups');
  };
  const reset = () => {
    setGroupWhatIf({});
    setKoResults({});
    setDraft({});
  };

  const setKo = (matchId: string, patch: KoResult) => {
    setKoResults((prev) => {
      const next = { ...(prev[matchId] ?? {}), ...patch };
      const empty =
        next.h == null && next.a == null && next.penH == null && next.penA == null && !next.et;
      const copy = { ...prev };
      if (empty) delete copy[matchId];
      else copy[matchId] = next;
      return copy;
    });
  };

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-[#0a0e16]/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h1 className="text-lg font-bold tracking-tight text-white">World Cup 2026</h1>
              <span className="text-xs text-slate-400">{phaseLabel}</span>
              {view && view.status.liveMatchCount > 0 && scenarioCount === 0 && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-red-500" />
                  {view.status.liveMatchCount} live
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
            {([
              ['groups', 'Groups & tables'],
              ['bracket', 'Projected bracket'],
              ['whatif', 'What-if'],
            ] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
                {t === 'whatif' && scenarioCount > 0 && (
                  <span className="ml-1.5 rounded bg-emerald-600 px-1 text-[10px] text-white">{scenarioCount}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 space-y-6">
        {!view ? (
          <div className="py-20 text-center text-slate-500">Loading the tournament…</div>
        ) : (
          <>
            {scenarioCount > 0 && tab !== 'whatif' && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-4 py-2 text-sm">
                <span className="text-emerald-200">
                  What-if scenario active — {scenarioCount} hypothetical result{scenarioCount > 1 ? 's' : ''} applied.
                </span>
                <button type="button" onClick={reset} className="text-emerald-300 underline hover:text-emerald-100">
                  Clear
                </button>
              </div>
            )}

            {tab === 'whatif' ? (
              <WhatIfEditor
                matches={snapshot!.matches}
                teams={teams}
                draft={draft}
                committedCount={Object.keys(groupWhatIf).length}
                onChange={setDraft}
                onCalculate={calculate}
                onReset={reset}
              />
            ) : (
              <LiveScores matches={view.matches} teams={teams} />
            )}

            {tab === 'groups' && (
              <>
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {view.groupTables.map((table) => (
                    <GroupTable key={table.group} table={table} teams={teams} qualification={view.qualification} />
                  ))}
                </section>
                <section className="max-w-2xl">
                  <ThirdPlaceTable ranking={view.thirdPlace} teams={teams} />
                </section>
              </>
            )}

            {tab === 'bracket' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-3xl text-xs text-slate-500">
                    Projected matchups <span className="text-slate-400">as it stands</span> — winners/runners-up
                    are current standings, the eight best thirds are slotted via FIFA's combination table, and
                    names turn <span className="text-emerald-300">green</span> once a team has qualified. Turn on
                    edit mode to enter knockout scores (with extra time / penalties) and watch winners advance.
                  </p>
                  <label className="flex shrink-0 items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={bracketEdit}
                      onChange={(e) => setBracketEdit(e.target.checked)}
                      className="accent-emerald-500"
                    />
                    Edit results
                  </label>
                </div>
                <Bracket
                  bracket={view.bracket}
                  teams={teams}
                  qualification={view.qualification}
                  editable={bracketEdit}
                  results={koResults}
                  onChange={setKo}
                />
              </>
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-600">
        <p>
          Standings, qualification & bracket computed live from match results · source:{' '}
          {snapshot?.source.provider ?? '—'}. Not affiliated with FIFA.
        </p>
      </footer>
    </div>
  );
}
