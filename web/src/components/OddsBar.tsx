import { useI18n } from '../lib/i18n';
import { oddsColor, oddsPct } from '../lib/odds';

interface Props {
  /** Probability in 0..1. */
  value: number;
  title?: string;
  className?: string;
}

/** A horizontal probability bar with a centered percentage label. */
export function OddsBar({ value, title, className = '' }: Props) {
  const { num } = useI18n();
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      title={title}
      dir="ltr"
      className={`relative h-4 overflow-hidden rounded bg-slate-800/80 ${className}`}
    >
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-300"
        style={{ width: `${v > 0 ? Math.max(v * 100, 3) : 0}%`, backgroundColor: oddsColor(v) }}
      />
      <span
        className="relative z-10 flex h-full items-center justify-center px-1 text-[10px] font-semibold tabular-nums text-white"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
      >
        {oddsPct(v, num)}
      </span>
    </div>
  );
}
