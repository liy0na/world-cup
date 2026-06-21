import { useEffect, useRef, useState } from 'react';
import type { Match } from '@wc/shared';

export type FlashSide = 'home' | 'away' | 'both';

/** How long a card keeps pulsing after a goal (ms). */
const FLASH_MS = 6000;

/**
 * Detects goals in live matches by comparing successive snapshots: when a live
 * match's home/away score increases, that match flashes for a few seconds.
 * Returns a map of match id -> which side(s) just scored. The first snapshot
 * only seeds the baseline (no flash on initial load).
 */
export function useGoalFlash(matches: Match[]): Map<string, FlashSide> {
  const prev = useRef<Map<string, { h: number; a: number }>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [flashing, setFlashing] = useState<Map<string, FlashSide>>(new Map());

  useEffect(() => {
    const next = new Map<string, { h: number; a: number }>();
    const newly: [string, FlashSide][] = [];
    for (const m of matches) {
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') continue;
      next.set(m.id, { h: m.homeScore, a: m.awayScore });
      if (m.status !== 'live') continue;
      const before = prev.current.get(m.id);
      if (!before) continue; // newly-seen live match — baseline only, don't flash
      const home = m.homeScore > before.h;
      const away = m.awayScore > before.a;
      if (home || away) newly.push([m.id, home && away ? 'both' : home ? 'home' : 'away']);
    }
    prev.current = next;
    if (newly.length === 0) return;

    setFlashing((cur) => {
      const n = new Map(cur);
      for (const [id, side] of newly) n.set(id, side);
      return n;
    });
    for (const [id] of newly) {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setFlashing((cur) => {
            if (!cur.has(id)) return cur;
            const n = new Map(cur);
            n.delete(id);
            return n;
          });
        }, FLASH_MS),
      );
    }
  }, [matches]);

  // Clear any pending timers on unmount.
  const timersRef = timers;
  useEffect(() => () => timersRef.current.forEach((t) => clearTimeout(t)), [timersRef]);

  return flashing;
}
