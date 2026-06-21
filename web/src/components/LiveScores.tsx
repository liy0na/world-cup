import { useState } from 'react';
import type { GoalEvent, Match } from '@wc/shared';
import { Flag } from '../lib/flags';
import { fmtNum, useI18n } from '../lib/i18n';
import { kickoffDay, kickoffLabel } from '../lib/format';
import { slotDisplay } from '../lib/teamNames';
import { slotCode, type TeamMap } from '../lib/teams';
import type { Lang } from '../lib/i18n';
import { useGoalFlash, type FlashSide } from '../hooks/useGoalFlash';

interface Props {
  matches: Match[];
  teams: TeamMap;
}

type T = (key: string, params?: Record<string, string | number>) => string;

function stageKey(m: Match): string {
  return `round.${m.stage === 'group' ? 'r32' : m.stage}`;
}

/** Collapse multiple goals by the same player into "Name 12', 45'+2'" (a.la. broadcast graphics). */
function scorerSummary(goals: GoalEvent[], lang: Lang, t: T): { player: string; minutes: string }[] {
  const order: string[] = [];
  const mins = new Map<string, string[]>();
  for (const g of [...goals].sort((a, b) => a.order - b.order)) {
    const key = g.player || '—';
    if (!mins.has(key)) {
      mins.set(key, []);
      order.push(key);
    }
    const tag = g.kind === 'own' ? ` ${t('ogTag')}` : g.kind === 'penalty' ? ` ${t('penTag')}` : '';
    mins.get(key)!.push(`${fmtNum(g.minute, lang)}${tag}`);
  }
  return order.map((player) => ({ player, minutes: mins.get(player)!.join(', ') }));
}

function ScorerLine({ code, goals, lang, t }: { code: string; goals: GoalEvent[]; lang: Lang; t: T }) {
  if (goals.length === 0) return null;
  return (
    <div className="flex gap-2">
      <span className="mt-px w-8 shrink-0 font-mono text-[10px] uppercase tracking-wider text-slate-500">{code}</span>
      <div className="min-w-0 flex-1 space-y-0.5 text-[11px] leading-tight">
        {scorerSummary(goals, lang, t).map((s) => (
          // Name at the start, minutes pushed to the end (left in RTL); dir=ltr keeps
          // the "12'" / "45'+2'" minute formatting correct inside a Persian layout.
          <div key={s.player} className="flex items-baseline justify-between gap-3">
            <span className="truncate text-slate-300">{s.player}</span>
            <span dir="ltr" className="shrink-0 text-slate-500">{s.minutes}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamRow({
  code,
  name,
  score,
  show,
  live,
  scored,
  lang,
}: {
  code: string;
  name: string;
  score?: number;
  show: boolean;
  live: boolean;
  scored: boolean;
  lang: Lang;
}) {
  const scoreColor = scored ? 'goal-pop text-emerald-300' : live ? 'text-red-300' : 'text-slate-100';
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-2 min-w-0">
        <Flag code={code} />
        <span className="font-mono text-[11px] text-slate-500 w-8 shrink-0">{code}</span>
        <span className="text-sm text-slate-200 truncate">{name}</span>
      </div>
      <span className={`tabular-nums text-base font-semibold ${scoreColor}`}>
        {show && typeof score === 'number' ? fmtNum(score, lang) : '–'}
      </span>
    </div>
  );
}

function MatchCard({
  match,
  teams,
  t,
  lang,
  flash,
  showScorers,
}: {
  match: Match;
  teams: TeamMap;
  t: T;
  lang: Lang;
  flash?: FlashSide;
  showScorers: boolean;
}) {
  const live = match.status === 'live';
  const finished = match.status === 'finished';
  const hasScore = typeof match.homeScore === 'number' && typeof match.awayScore === 'number';
  const tag = match.group ? t('group', { x: match.group }) : t(stageKey(match));
  const homeCode = slotCode(match.home, teams);
  const awayCode = slotCode(match.away, teams);
  const goals = match.goals ?? [];
  const homeGoals = goals.filter((g) => g.teamId === match.home.teamId);
  const awayGoals = goals.filter((g) => g.teamId === match.away.teamId);

  return (
    <div className={`w-64 shrink-0 rounded-lg border bg-slate-900/50 p-3 ${flash ? 'goal-flash' : 'border-slate-800'}`}>
      <div className="flex items-center justify-between mb-1.5 text-[10px] uppercase tracking-wider">
        <span className="text-slate-500">{tag}</span>
        {flash ? (
          <span className="flex items-center gap-1 font-semibold text-emerald-400">⚽ {t('goalBadge')}</span>
        ) : live ? (
          <span className="flex items-center gap-1 text-red-400">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-red-500" />
            {match.minute ? `${fmtNum(match.minute, lang)}'` : t('live')}
          </span>
        ) : finished ? (
          <span className="text-slate-500">{t('ft')}</span>
        ) : (
          <span className="text-slate-500">
            {kickoffDay(match.kickoff, lang)} · {kickoffLabel(match.kickoff, lang)}
          </span>
        )}
      </div>

      <TeamRow
        code={homeCode}
        name={slotDisplay(match.home, teams, lang, t)}
        score={match.homeScore}
        show={hasScore}
        live={live}
        scored={flash === 'home' || flash === 'both'}
        lang={lang}
      />
      <TeamRow
        code={awayCode}
        name={slotDisplay(match.away, teams, lang, t)}
        score={match.awayScore}
        show={hasScore}
        live={live}
        scored={flash === 'away' || flash === 'both'}
        lang={lang}
      />

      {showScorers && (homeGoals.length > 0 || awayGoals.length > 0) && (
        <div className="mt-2 space-y-1 border-t border-slate-800/70 pt-2">
          <ScorerLine code={homeCode} goals={homeGoals} lang={lang} t={t} />
          <ScorerLine code={awayCode} goals={awayGoals} lang={lang} t={t} />
        </div>
      )}
    </div>
  );
}

function Strip({
  title,
  badge,
  matches,
  teams,
  t,
  lang,
  flash,
  showScorers,
}: {
  title: string;
  badge?: string;
  matches: Match[];
  teams: TeamMap;
  t: T;
  lang: Lang;
  flash: Map<string, FlashSide>;
  showScorers: boolean;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
        {badge && <span className="text-xs text-red-400">{badge}</span>}
      </div>
      <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} teams={teams} t={t} lang={lang} flash={flash.get(m.id)} showScorers={showScorers} />
        ))}
      </div>
    </section>
  );
}

export function LiveScores({ matches, teams }: Props) {
  const { t, lang } = useI18n();
  const flash = useGoalFlash(matches);
  const [showScorers, setShowScorers] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('showScorers') === '1',
  );
  const toggleScorers = () => {
    setShowScorers((v) => {
      const next = !v;
      try {
        localStorage.setItem('showScorers', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const group = matches.filter((m) => m.stage === 'group');
  const live = group.filter((m) => m.status === 'live');
  const byKickoff = (a: Match, b: Match) => Date.parse(a.kickoff) - Date.parse(b.kickoff);
  const recent = group.filter((m) => m.status === 'finished').sort(byKickoff).slice(-12).reverse();
  const upcoming = group.filter((m) => m.status === 'scheduled').sort(byKickoff).slice(0, 10);

  if (live.length + recent.length + upcoming.length === 0) return null;

  // Only worth offering the toggle when some shown game actually has scorers.
  const hasGoals = [...live, ...recent].some((m) => m.goals && m.goals.length > 0);
  const common = { teams, t, lang, flash, showScorers };
  return (
    <div className="space-y-5">
      {hasGoals && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleScorers}
            aria-pressed={showScorers}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              showScorers
                ? 'border-emerald-600/60 bg-emerald-600/15 text-emerald-300'
                : 'border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚽ {t('scorers')}
          </button>
        </div>
      )}
      {live.length > 0 && <Strip title={t('liveNow')} badge={t('inPlay', { n: live.length })} matches={live} {...common} />}
      {recent.length > 0 && <Strip title={t('recentResults')} matches={recent} {...common} />}
      {upcoming.length > 0 && <Strip title={t('upcoming')} matches={upcoming} {...common} />}
    </div>
  );
}
