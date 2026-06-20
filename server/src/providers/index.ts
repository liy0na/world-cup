import type { Config } from '../config';
import { FifaLiveProvider } from './fifa';
import { OpenFootballProvider } from './openfootball';
import type { DataProvider } from './provider';

export interface Providers {
  /** Authoritative schedule/groups/results backbone. */
  backbone: DataProvider;
  /** Optional in-play overlay. */
  live?: DataProvider;
}

/**
 * Select providers from config. Default (free): openfootball backbone + the
 * unofficial FIFA live overlay. Paid adapters (API-Football / TheSportsDB
 * Premium) plug in here when a key is configured — they implement the same
 * DataProvider interface, so enabling them is config-only.
 */
export function createProviders(config: Config): Providers {
  // if (config.apiFootballKey) { backbone = new ApiFootballProvider(config.apiFootballKey); ... }
  const backbone = new OpenFootballProvider(config.openFootballBase);
  const live = config.fifaLive ? new FifaLiveProvider() : undefined;
  return { backbone, live };
}
