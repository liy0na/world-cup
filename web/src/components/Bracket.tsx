import type { ReactElement } from 'react';
import type { Bracket as BracketType, BracketMatch, Qualification, SlotRef } from '@wc/shared';
import { Flag } from '../lib/flags';
import { kickoffDay, kickoffTime } from '../lib/format';
import { fmtNum, toLatinDigits, useI18n, type Lang } from '../lib/i18n';
import { bracketNameClass } from '../lib/status';
import { slotDisplay } from '../lib/teamNames';
import { isResolved, slotCode, type TeamMap } from '../lib/teams';
import { NextMatchTimer, hasNextMatch } from './NextMatchTimer';

export interface KoResult {
  h?: number;
  a?: number;
  penH?: number;
  penA?: number;
  et?: boolean;
}

type T = (key: string, params?: Record<string, string | number>) => string;

interface Props {
  bracket: BracketType;
  teams: TeamMap;
  qualification: Qualification;
  editable: boolean;
  results: Record<string, KoResult>;
  /** Match numbers whose real result is in — locked against what-if editing. */
  locked: Set<number>;
  onChange: (matchId: string, patch: KoResult) => void;
}

// Compact, language-neutral round tags for the card header.
const SHORT: Record<BracketMatch['stage'], string> = {
  r32: 'R32',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  third: '3rd',
  final: 'F',
};

const parseFeeder = (s: string): number | null => {
  const m = s.match(/^W(\d+)$/);
  return m ? Number(m[1]) : null;
};

const LINE = 'bg-slate-700';

function Connector() {
  return (
    <div className="relative w-8 self-stretch shrink-0">
      <span className={`absolute left-0 top-1/4 h-px w-1/2 ${LINE}`} />
      <span className={`absolute left-0 top-3/4 h-px w-1/2 ${LINE}`} />
      <span className={`absolute left-1/2 top-1/4 h-1/2 w-px ${LINE}`} />
      <span className={`absolute left-1/2 top-1/2 h-px w-1/2 ${LINE}`} />
    </div>
  );
}

function Num({
  value,
  onChange,
  label,
  lang,
}: {
  value: number | undefined;
  onChange: (v: string) => void;
  label: string;
  lang: Lang;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={value === undefined ? '' : fmtNum(value, lang)}
      onChange={(e) => onChange(toLatinDigits(e.target.value).replace(/[^0-9]/g, ''))}
      className="w-8 rounded border border-slate-700 bg-slate-950 px-0.5 text-center text-[13px] tabular-nums text-slate-100 focus:border-emerald-500 focus:outline-none"
    />
  );
}

function SlotLine({
  slot,
  teams,
  qualification,
  score,
  isWinner,
  editable,
  onScore,
  lang,
  t,
}: {
  slot: SlotRef;
  teams: TeamMap;
  qualification: Qualification;
  score: number | undefined;
  isWinner: boolean;
  editable: boolean;
  onScore: (v: string) => void;
  lang: Lang;
  t: T;
}) {
  const resolved = isResolved(slot);
  const outlook = slot.teamId ? qualification.byTeam[slot.teamId]?.outlook : undefined;
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1">
      <div className="flex items-center gap-2 min-w-0">
        {resolved ? <Flag code={slotCode(slot, teams)} /> : <span className="w-5 shrink-0" />}
        <span className="font-mono text-[10px] text-slate-500 w-8 shrink-0">{resolved ? slotCode(slot, teams) : ''}</span>
        <span
          className={`truncate text-[13px] ${resolved ? bracketNameClass(outlook) : 'italic text-slate-500'} ${
            isWinner ? 'font-semibold' : ''
          }`}
        >
          {slotDisplay(slot, teams, lang, t)}
        </span>
        {isWinner && <span className="text-emerald-400 text-[11px]">✓</span>}
      </div>
      {editable && resolved ? (
        <Num value={score} onChange={onScore} label="score" lang={lang} />
      ) : (
        <span className="tabular-nums text-[13px] text-slate-300">{typeof score === 'number' ? fmtNum(score, lang) : ''}</span>
      )}
    </div>
  );
}

function MatchCard({
  match,
  teams,
  qualification,
  editable,
  locked,
  result,
  onChange,
  isNext,
  lang,
  t,
}: {
  match: BracketMatch;
  teams: TeamMap;
  qualification: Qualification;
  editable: boolean;
  /** This match already has a real result — display it, never accept what-if scores. */
  locked: boolean;
  result: KoResult | undefined;
  onChange: (matchId: string, patch: KoResult) => void;
  /** The soonest upcoming match — highlighted so it's easy to spot. */
  isNext: boolean;
  lang: Lang;
  t: T;
}) {
  const id = `m${match.matchNumber}`;
  const live = match.status === 'live';
  const border = live ? 'border-red-500/60' : isNext ? 'border-amber-500/60' : 'border-slate-800';
  const bothResolved = Boolean(match.home.teamId && match.away.teamId);
  // Real results are locked in; only resolved, not-yet-decided matches accept what-if scores.
  const canEdit = editable && bothResolved && !locked;
  const hScore = canEdit ? result?.h : match.homeScore;
  const aScore = canEdit ? result?.a : match.awayScore;
  const level = typeof hScore === 'number' && hScore === aScore;
  const homeWins = match.winnerTeamId && match.winnerTeamId === match.home.teamId;
  const awayWins = match.winnerTeamId && match.winnerTeamId === match.away.teamId;
  const slotProps = { teams, qualification, lang, t };

  return (
    <div className={`w-52 shrink-0 rounded-lg border bg-slate-900/60 ${border}`}>
      <div className="flex items-center justify-between px-2 pt-1 text-[9px] uppercase tracking-wider text-slate-600">
        <span>
          {SHORT[match.stage]} · M{fmtNum(match.matchNumber, lang)}
        </span>
        <span className="flex items-center gap-1">
          {match.afterExtraTime && <span className="text-slate-500">{t('aet')}</span>}
          {editable && locked && bothResolved && (
            <span className="text-slate-500" title={t('lockedResult')} aria-label={t('lockedResult')}>
              🔒
            </span>
          )}
          {live ? (
            <span className="flex items-center gap-1 text-red-400">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-red-500" />
              {t('live')}
            </span>
          ) : (
            isNext && <span className="text-amber-400">{t('nextMatch')}</span>
          )}
        </span>
      </div>
      <SlotLine
        slot={match.home}
        score={hScore}
        isWinner={Boolean(homeWins)}
        editable={canEdit}
        onScore={(v) => onChange(id, { h: v === '' ? undefined : Number(v) })}
        {...slotProps}
      />
      <div className="border-t border-slate-800/60" />
      <SlotLine
        slot={match.away}
        score={aScore}
        isWinner={Boolean(awayWins)}
        editable={canEdit}
        onScore={(v) => onChange(id, { a: v === '' ? undefined : Number(v) })}
        {...slotProps}
      />
      {canEdit && level ? (
        <div className="flex items-center gap-2 border-t border-slate-800/60 px-2 py-1 text-[11px]">
          <span className="text-slate-500">{t('pens')}</span>
          <Num value={result?.penH} onChange={(v) => onChange(id, { penH: v === '' ? undefined : Number(v) })} label="home penalties" lang={lang} />
          <span className="text-slate-600">–</span>
          <Num value={result?.penA} onChange={(v) => onChange(id, { penA: v === '' ? undefined : Number(v) })} label="away penalties" lang={lang} />
          <label className="ms-auto flex items-center gap-1 text-slate-500">
            <input type="checkbox" checked={Boolean(result?.et)} onChange={(e) => onChange(id, { et: e.target.checked })} className="accent-emerald-500" />
            {t('aet')}
          </label>
        </div>
      ) : !canEdit && match.penalties ? (
        <div className="border-t border-slate-800/60 px-2 py-0.5 text-end text-[10px] text-slate-500">
          {t('pens')} {fmtNum(match.penalties.home, lang)}–{fmtNum(match.penalties.away, lang)}
        </div>
      ) : null}
      {(match.kickoff || match.venue) && (
        <div className="flex items-center gap-1.5 border-t border-slate-800/60 px-2 py-0.5 text-[9px] text-slate-500">
          {match.kickoff && (
            <span className="shrink-0 whitespace-nowrap" dir="ltr">
              🕒 {kickoffDay(match.kickoff, lang)}, {kickoffTime(match.kickoff, lang)}
            </span>
          )}
          {match.venue && (
            <span className="min-w-0 truncate" title={match.venue}>
              📍 {match.venue}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function Bracket({ bracket, teams, qualification, editable, results, locked, onChange }: Props) {
  const { t, lang } = useI18n();
  const all = [...bracket.r32, ...bracket.r16, ...bracket.qf, ...bracket.sf, ...bracket.final, ...bracket.third];
  const byNumber = new Map(all.map((m) => [m.matchNumber, m]));

  // Match number of the soonest upcoming game — highlighted so it's easy to find
  // in the tree. Suppressed while a game is live (that one is flagged instead).
  const nextMatchNumber = all.some((m) => m.status === 'live')
    ? undefined
    : all
        .filter((m) => m.status === 'scheduled' && Number.isFinite(Date.parse(m.kickoff ?? '')))
        .sort((a, b) => Date.parse(a.kickoff!) - Date.parse(b.kickoff!))[0]?.matchNumber;

  const feeders = (m: BracketMatch): number[] => {
    const h = parseFeeder(m.home.source);
    const a = parseFeeder(m.away.source);
    return h !== null && a !== null ? [h, a] : [];
  };

  const third = bracket.third[0];
  const card = (m: BracketMatch) => (
    <MatchCard match={m} result={results[`m${m.matchNumber}`]} teams={teams} qualification={qualification} editable={editable} locked={locked.has(m.matchNumber)} onChange={onChange} isNext={m.matchNumber === nextMatchNumber} lang={lang} t={t} />
  );

  const Node = ({ n }: { n: number }): ReactElement | null => {
    const m = byNumber.get(n);
    if (!m) return null;
    const fds = feeders(m);
    if (fds.length < 2) return <div className="my-1.5">{card(m)}</div>;

    const right =
      n === 104 && third ? (
        <div className="relative">
          <div className="absolute bottom-full left-0 w-52 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-500/80">
            {t('finalHeading')}
          </div>
          {card(m)}
          <div className="absolute left-0 top-full w-52 pt-6">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-500/80">{t('thirdPlayoff')}</div>
            {card(third)}
          </div>
        </div>
      ) : (
        card(m)
      );

    return (
      <div className="flex items-center">
        <div className="flex flex-col justify-center">
          <Node n={fds[0]!} />
          <Node n={fds[1]!} />
        </div>
        <Connector />
        {right}
      </div>
    );
  };

  const rounds: BracketMatch['stage'][] = ['r32', 'r16', 'qf', 'sf'];

  // Force LTR: the tree layout + connectors are built left-to-right; Persian
  // team names still render correctly inside the cards.
  return (
    <div>
      {hasNextMatch(all) && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('nextMatch')}</span>
          <NextMatchTimer matches={all} />
        </div>
      )}
      <section dir="ltr" className="overflow-x-auto pb-4">
        <div className="min-w-max">
          <div className="mb-2 flex gap-8">
            {rounds.map((s) => (
              <div key={s} className="w-52 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {t(`round.${s}`)}
              </div>
            ))}
          </div>
          <Node n={104} />
        </div>
      </section>
    </div>
  );
}
