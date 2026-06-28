import { useEffect, useRef, useState } from 'react';
import type { Match, Team, TitleOdds } from '@wc/shared';

/**
 * Run the knockout title Monte-Carlo in a Web Worker so 10k bracket simulations
 * never block the UI. Recomputes (debounced) whenever the teams/matches change —
 * e.g. when a knockout result arrives or a what-if scenario is applied. The
 * simulation short-circuits (ready:false) until the group stage is complete.
 */
export function useTitleOdds(
  teams: Team[] | undefined,
  matches: Match[] | undefined,
  iterations = 10000,
): { title: TitleOdds | undefined } {
  const [title, setTitle] = useState<TitleOdds>();
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/title.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<TitleOdds>) => setTitle(e.data);
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || !teams || !matches || teams.length === 0) return;
    const id = setTimeout(() => worker.postMessage({ teams, matches, iterations }), 200);
    return () => clearTimeout(id);
  }, [teams, matches, iterations]);

  return { title };
}
