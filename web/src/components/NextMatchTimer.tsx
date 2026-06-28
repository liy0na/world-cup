import { useEffect, useState } from 'react';
import type { MatchStatus } from '@wc/shared';
import { useI18n } from '../lib/i18n';

type T = (key: string, params?: Record<string, string | number>) => string;

/** Minimal shape shared by group `Match` and knockout `BracketMatch`. */
interface TimerMatch {
  status?: MatchStatus;
  kickoff?: string;
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Format a future delta (ms) as a compact countdown, localised. */
function formatCountdown(ms: number, num: (v: number | string) => string, t: T): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return t('cdDaysHours', { d: num(d), h: num(h) });
  if (h > 0) return `${num(pad2(h))}:${num(pad2(m))}:${num(pad2(s))}`;
  return `${num(pad2(m))}:${num(pad2(s))}`;
}

/** Whether the timer has anything to show (a live match or an upcoming kickoff). */
export function hasNextMatch(matches: TimerMatch[]): boolean {
  return (
    matches.some((m) => m.status === 'live') ||
    matches.some((m) => m.status === 'scheduled' && Number.isFinite(Date.parse(m.kickoff ?? '')))
  );
}

/** Countdown to the next scheduled match; shows "Live now" while a match is in play. */
export function NextMatchTimer({ matches }: { matches: TimerMatch[] }) {
  const { t, num } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (matches.some((m) => m.status === 'live')) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-red-400">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-red-500" />
        {t('liveNow')}
      </span>
    );
  }

  const next = matches
    .filter((m) => m.status === 'scheduled')
    .map((m) => Date.parse(m.kickoff ?? ''))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)[0];
  if (next == null) return null;

  const diff = next - now;
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-amber-300" title={t('upcoming')}>
      <ClockIcon />
      {diff > 0 ? <span dir="ltr">{formatCountdown(diff, num, t)}</span> : t('kickingOff')}
    </span>
  );
}
