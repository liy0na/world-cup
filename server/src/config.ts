import { resolve } from 'node:path';

const num = (v: string | undefined, fallback: number): number => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export interface Config {
  host: string;
  port: number;
  /** Directory where the last-good snapshot is persisted. */
  dataDir: string;
  /** Built web SPA to serve (empty = API only, e.g. during `vite` dev). */
  webDist: string;
  /** Poll cadence (ms) while at least one match is live. */
  pollLiveMs: number;
  /** Poll cadence (ms) when matches are scheduled today but none are live. */
  pollMatchDayMs: number;
  /** Poll cadence (ms) when no matches are scheduled in the near window. */
  pollIdleMs: number;
  /** Whether to attempt the unofficial FIFA live overlay. */
  fifaLive: boolean;
  /** openfootball raw base (override for testing/mirrors). */
  openFootballBase: string;
  /** Optional paid provider key (enables the paid adapter when set). */
  apiFootballKey?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    host: env.HOST ?? '0.0.0.0',
    port: num(env.PORT, 8787),
    dataDir: resolve(env.DATA_DIR ?? './data'),
    webDist: env.WEB_DIST ?? resolve(process.cwd(), '../web/dist'),
    pollLiveMs: num(env.POLL_LIVE_MS, 45_000),
    pollMatchDayMs: num(env.POLL_MATCHDAY_MS, 10 * 60_000),
    pollIdleMs: num(env.POLL_IDLE_MS, 60 * 60_000),
    fifaLive: env.FIFA_LIVE !== 'false',
    openFootballBase:
      env.OPENFOOTBALL_BASE ??
      'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026',
    apiFootballKey: env.API_FOOTBALL_KEY || undefined,
  };
}
