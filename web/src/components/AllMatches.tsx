import { useState } from 'react';
import type { Match, Stage } from '@wc/shared';
import { Flag } from '../lib/flags';
import { kickoffDateHeading, kickoffDateKey, kickoffTime } from '../lib/format';
import { fmtNum, useI18n, type Lang } from '../lib/i18n';
import { slotDisplay } from '../lib/teamNames';
import { slotCode, type TeamMap } from '../lib/teams';
import { MatchDetailModal } from './MatchDetailModal';

interface Props {
  matches: Match[];
  teams: TeamMap;
}

type T = (key: string, params?: Record<string, string | number>) => string;

// Compact, language-neutral round tags.
const SHORT: Partial<Record<Stage, string>> = {
  r32: 'R32',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  third: '3rd',
  final: 'F',
};

function Row({
  match,
  teams,
  t,
  lang,
  onOpen,
}: {
  match: Match;
  teams: TeamMap;
  t: T;
  lang: Lang;
  onOpen: (m: Match) => void;
}) {
  const live = match.status === 'live';
  const finished = match.status === 'finished';
  const hasScore = typeof match.homeScore === 'number' && typeof match.awayScore === 'number';
  const clickable = live || finished;
  const tag = match.group ?? SHORT[match.stage] ?? '';
  const center = hasScore ? `${fmtNum(match.homeScore!, lang)} – ${fmtNum(match.awayScore!, lang)}` : 'v';

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onOpen(match) : undefined}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onOpen(match) : undefined}
      className={`flex items-center gap-2 px-3 py-2 text-sm ${clickable ? 'cursor-pointer hover:bg-slate-800/40' : ''}`}
    >
      <span className={`w-12 shrink-0 text-xs tabular-nums ${live ? 'text-red-400' : 'text-slate-500'}`}>
        {live ? (match.minute ? `${fmtNum(match.minute, lang)}'` : t('live')) : kickoffTime(match.kickoff, lang)}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="truncate text-slate-200">{slotDisplay(match.home, teams, lang, t)}</span>
        <Flag code={slotCode(match.home, teams)} />
      </div>
      <span
        className={`w-14 shrink-0 text-center font-semibold tabular-nums ${
          hasScore ? (live ? 'text-red-300' : 'text-slate-100') : 'text-slate-600'
        }`}
        dir="ltr"
      >
        {center}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Flag code={slotCode(match.away, teams)} />
        <span className="truncate text-slate-200">{slotDisplay(match.away, teams, lang, t)}</span>
      </div>
      <span className="w-9 shrink-0 text-end font-mono text-[10px] uppercase tracking-wider text-slate-500">{tag}</span>
    </div>
  );
}

/** Every match of the tournament, grouped by day; rows open the detail modal. */
export function AllMatches({ matches, teams }: Props) {
  const { t, lang } = useI18n();
  const [selected, setSelected] = useState<Match | null>(null);

  const sorted = [...matches].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const days: { key: string; heading: string; matches: Match[] }[] = [];
  for (const m of sorted) {
    const key = kickoffDateKey(m.kickoff);
    const last = days[days.length - 1];
    if (last && last.key === key) last.matches.push(m);
    else days.push({ key, heading: kickoffDateHeading(m.kickoff, lang), matches: [m] });
  }

  const selectedMatch = selected ? (matches.find((m) => m.id === selected.id) ?? selected) : null;

  return (
    <div className="space-y-5">
      {days.map((d) => (
        <section key={d.key}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{d.heading}</h3>
          <div className="divide-y divide-slate-800/60 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
            {d.matches.map((m) => (
              <Row key={m.id} match={m} teams={teams} t={t} lang={lang} onOpen={setSelected} />
            ))}
          </div>
        </section>
      ))}
      {selectedMatch && <MatchDetailModal match={selectedMatch} teams={teams} onClose={() => setSelected(null)} />}
    </div>
  );
}
