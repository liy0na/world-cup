import { useEffect, useState } from 'react';
import type { LineupPlayer, Match, MatchDetail, MatchTimelineEntry } from '@wc/shared';
import { Flag } from '../lib/flags';
import { kickoffDay, kickoffLabel } from '../lib/format';
import { fmtNum, useI18n } from '../lib/i18n';
import { teamName } from '../lib/teamNames';
import type { TeamMap } from '../lib/teams';

interface Props {
  match: Match;
  teams: TeamMap;
  onClose: () => void;
}

function EventIcon({ type }: { type: MatchTimelineEntry['type'] }) {
  if (type === 'yellow') return <span className="inline-block h-3 w-2.5 rounded-[1px] bg-yellow-400" />;
  if (type === 'red') return <span className="inline-block h-3 w-2.5 rounded-[1px] bg-red-500" />;
  if (type === 'sub') return <span className="text-emerald-400">⇄</span>;
  if (type === 'var') return <span className="rounded bg-slate-700 px-1 text-[9px] font-bold text-slate-200">VAR</span>;
  return <span>⚽</span>; // goal / penalty / own goal
}

function Lineup({ players, lang }: { players: LineupPlayer[]; lang: 'en' | 'fa' }) {
  const { t } = useI18n();
  const starters = players.filter((p) => p.starter);
  const subs = players.filter((p) => !p.starter);
  const row = (p: LineupPlayer) => (
    <li key={p.playerId} className="flex items-center gap-2 py-0.5 text-[13px]">
      <span className="w-5 shrink-0 text-end font-mono text-[10px] text-slate-500">
        {p.shirt != null ? fmtNum(p.shirt, lang) : ''}
      </span>
      <span className="truncate text-slate-200">{p.name}</span>
    </li>
  );
  return (
    <div>
      <ul>{starters.map(row)}</ul>
      {subs.length > 0 && (
        <>
          <div className="mt-2 mb-0.5 text-[10px] uppercase tracking-wider text-slate-500">{t('subsLabel')}</div>
          <ul className="opacity-70">{subs.map(row)}</ul>
        </>
      )}
    </div>
  );
}

export function MatchDetailModal({ match, teams, onClose }: Props) {
  const { t, lang } = useI18n();
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const ctrl = new AbortController();
    setDetail(null);
    setError(false);
    fetch(`/api/match/${match.id}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no detail'))))
      .then((d: MatchDetail) => setDetail(d))
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(true);
      });
    return () => ctrl.abort();
  }, [match.id]);

  const homeId = detail?.homeTeamId ?? match.home.teamId;
  const awayId = detail?.awayTeamId ?? match.away.teamId;
  const scoreFor = (id?: string) =>
    id === match.home.teamId ? match.homeScore : id === match.away.teamId ? match.awayScore : undefined;
  const hasScore = match.status !== 'scheduled' && typeof scoreFor(homeId) === 'number';
  const homeTeam = teams.get(homeId ?? '');
  const awayTeam = teams.get(awayId ?? '');

  const TeamHead = ({ id, align }: { id?: string; align: 'start' | 'end' }) => {
    const team = teams.get(id ?? '');
    return (
      <div className={`flex flex-1 items-center gap-2 ${align === 'end' ? 'flex-row-reverse text-end' : ''} min-w-0`}>
        <Flag code={team?.code} />
        <span className="truncate font-semibold text-slate-100">{teamName(team, lang) || id}</span>
      </div>
    );
  };

  const pens = match.penalties;
  const aet = match.afterExtraTime || Boolean(pens);
  const status =
    match.status === 'live'
      ? match.minute
        ? `${fmtNum(match.minute, lang)}'`
        : t('live')
      : match.status === 'finished'
        ? aet
          ? t('aet')
          : t('ft')
        : `${kickoffDay(match.kickoff, lang)} · ${kickoffLabel(match.kickoff, lang)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-6 w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-800 p-4">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500">
            <span>{match.group ? t('group', { x: match.group }) : ''}</span>
            <span className={match.status === 'live' ? 'text-red-400' : ''}>{status}</span>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200" aria-label="close">
              ✕
            </button>
          </div>
          <div className="flex items-center gap-3">
            <TeamHead id={homeId} align="start" />
            <div className="shrink-0 px-2 text-center" dir="ltr">
              <div className="text-xl font-bold tabular-nums text-slate-100">
                {hasScore ? `${fmtNum(scoreFor(homeId)!, lang)} – ${fmtNum(scoreFor(awayId)!, lang)}` : 'vs'}
              </div>
              {hasScore && (pens || match.fullTime) && (
                <div className="flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  {match.fullTime && (
                    <span>
                      {t('ft')} {fmtNum(match.fullTime.home, lang)}–{fmtNum(match.fullTime.away, lang)}
                    </span>
                  )}
                  {pens && (
                    <span>
                      {t('pens')} {fmtNum(pens.home, lang)}–{fmtNum(pens.away, lang)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <TeamHead id={awayId} align="end" />
          </div>
        </div>

        {error ? (
          <p className="p-6 text-center text-sm text-slate-500">{t('detailError')}</p>
        ) : !detail ? (
          <p className="p-6 text-center text-sm text-slate-500">{t('loading')}</p>
        ) : (
          <div className="space-y-4 p-4">
            {/* Facts */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              {(detail.venue || match.venue) && (
                <span>📍 {detail.venue ? [detail.venue, detail.city].filter(Boolean).join(', ') : match.venue}</span>
              )}
              {detail.attendance ? (
                <span>
                  👥 {t('attendance')}: {fmtNum(detail.attendance, lang)}
                </span>
              ) : null}
              {detail.referee && (
                <span>
                  🧑‍⚖️ {t('referee')}: {detail.referee}
                </span>
              )}
            </div>

            {detail.possession && (
              <div>
                <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-500">
                  <span>{t('possession')}</span>
                  <span dir="ltr">
                    {fmtNum(detail.possession.home, lang)}% · {fmtNum(detail.possession.away, lang)}%
                  </span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div className="bg-emerald-500" style={{ width: `${detail.possession.home}%` }} />
                  <div className="bg-sky-500" style={{ width: `${detail.possession.away}%` }} />
                </div>
              </div>
            )}

            {/* Timeline */}
            {detail.events.length > 0 && (
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{t('matchEvents')}</div>
                <ul className="space-y-1">
                  {detail.events.map((e, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-[13px]">
                      <span className="w-9 shrink-0 text-end font-mono text-[11px] text-slate-500" dir="ltr">
                        {fmtNum(e.minute, lang)}
                      </span>
                      <span className="w-4 shrink-0 text-center">
                        <EventIcon type={e.type} />
                      </span>
                      <span className="text-slate-300">{e.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lineups */}
            {(detail.homeLineup.length > 0 || detail.awayLineup.length > 0) && (
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{t('lineups')}</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                      <Flag code={homeTeam?.code} /> {homeTeam?.code ?? homeId}
                    </div>
                    <Lineup players={detail.homeLineup} lang={lang} />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                      <Flag code={awayTeam?.code} /> {awayTeam?.code ?? awayId}
                    </div>
                    <Lineup players={detail.awayLineup} lang={lang} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
