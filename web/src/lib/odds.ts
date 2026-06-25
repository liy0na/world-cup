/** Red (long shot) → amber → green (near-certain) for a 0..1 probability. */
export function oddsColor(v: number): string {
  return `hsl(${Math.round(Math.max(0, Math.min(1, v)) * 120)} 64% 42%)`;
}

/** Compact percentage label that avoids a misleading "0%"/"100%" near the edges. */
export function oddsPct(v: number, num: (x: number | string) => string): string {
  if (v <= 0) return `${num(0)}%`;
  if (v >= 1) return `${num(100)}%`;
  if (v < 0.005) return `<${num(1)}%`;
  if (v > 0.995) return `>${num(99)}%`;
  return `${num(Math.round(v * 100))}%`;
}
