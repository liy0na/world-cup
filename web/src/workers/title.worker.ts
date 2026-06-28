/// <reference lib="webworker" />
import { simulateKnockout, type Match, type Team } from '@wc/shared';

interface Req {
  teams: Team[];
  matches: Match[];
  iterations: number;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { teams, matches, iterations } = e.data;
  const title = simulateKnockout(teams, matches, { iterations });
  (self as DedicatedWorkerGlobalScope).postMessage(title);
};
