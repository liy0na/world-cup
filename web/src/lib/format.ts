import type { Lang } from './i18n';

const locale = (lang: Lang) => (lang === 'fa' ? 'fa-IR' : 'en-US');

/** Localised "x minutes ago" via Intl.RelativeTimeFormat (Persian numerals + wording for fa). */
export function timeAgo(iso: string, lang: Lang): string {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return '';
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' });
  const s = Math.round(ms / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(Math.round(s), 'second');
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

export function kickoffDay(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale(lang), { month: 'short', day: 'numeric' });
}

export function kickoffLabel(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(locale(lang), { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
