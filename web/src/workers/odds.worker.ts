/// <reference lib="webworker" />
import { simulateAdvancement, type Match, type Team } from '@wc/shared';

interface Req {
  teams: Team[];
  matches: Match[];
  iterations: number;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { teams, matches, iterations } = e.data;
  const odds = simulateAdvancement(teams, matches, { iterations });
  (self as DedicatedWorkerGlobalScope).postMessage(odds);
};
