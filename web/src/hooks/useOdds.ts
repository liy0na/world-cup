import { useEffect, useRef, useState } from 'react';
import type { AdvancementOdds, Match, Team } from '@wc/shared';

/**
 * Run the qualification-odds Monte-Carlo in a Web Worker so 10k simulations
 * never block the UI. Recomputes (debounced) whenever the teams/matches change —
 * e.g. when live results arrive or a what-if scenario is applied.
 */
export function useOdds(
  teams: Team[] | undefined,
  matches: Match[] | undefined,
  iterations = 10000,
): { odds: AdvancementOdds | undefined; loading: boolean } {
  const [odds, setOdds] = useState<AdvancementOdds>();
  const [loading, setLoading] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/odds.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<AdvancementOdds>) => {
      setOdds(e.data);
      setLoading(false);
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || !teams || !matches || teams.length === 0) return;
    setLoading(true);
    const id = setTimeout(() => worker.postMessage({ teams, matches, iterations }), 200);
    return () => clearTimeout(id);
  }, [teams, matches, iterations]);

  return { odds, loading };
}
