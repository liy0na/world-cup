import { computeStandings, type MatchDetail, type Snapshot } from '@wc/shared';
import type { Config } from '../config';
import { GoalTracker } from '../pipeline/goals';
import { mergeLive, resolveKnockoutFixtures } from '../pipeline/matchStore';
import { buildSnapshot } from '../pipeline/snapshot';
import type { Providers } from '../providers';
import type { LiveObservation, MatchRef, Schedule } from '../providers/provider';
import type { SnapshotCache } from './cache';
import { RateLimiter } from './rateLimiter';

const BACKBONE_TTL_MS = 10 * 60_000;
const MATCH_WINDOW_MS = 3 * 60 * 60_000;
/** Concurrency for goal-timeline fetches (the cold start backfills every finished game). */
const GOAL_FETCH_CONCURRENCY = 6;

/**
 * The single poller. It decouples two clocks: how often we call upstream (this
 * loop, gated by the schedule + a hard rate limiter) vs. how often browsers see
 * updates (the SSE fan-out from the cache). Browsers never trigger upstream calls.
 */
export class Poller {
  private schedule: Schedule | undefined;
  private scheduleFetchedAt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | undefined;
  private stopped = false;
  private lastError: string | undefined;
  private readonly liveLimiter: RateLimiter;
  private readonly goals = new GoalTracker();
  private goalsSeeded = false;
  /** fixture id -> upstream ref, for on-demand match detail. */
  private readonly fixtureRefs = new Map<string, MatchRef>();
  private readonly detailCache = new Map<string, { detail: MatchDetail; at: number }>();

  constructor(
    private readonly providers: Providers,
    private readonly cache: SnapshotCache,
    private readonly config: Config,
  ) {
    // Generous for openfootball; conservative enough to never hammer the FIFA endpoint.
    this.liveLimiter = new RateLimiter({ perMinute: 6 });
  }

  async start(): Promise<void> {
    await this.refresh();
    this.scheduleNext();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /** Refresh now, coalescing concurrent callers into one upstream pass (single-flight). */
  refresh(): Promise<void> {
    this.inFlight ??= this.doRefresh().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  health(): Record<string, unknown> {
    const snap = this.cache.get();
    return {
      provider: snap?.source.provider,
      generatedAt: snap?.generatedAt,
      live: snap?.source.live ?? false,
      liveQuotaRemaining: this.liveLimiter.remainingToday,
      subscribers: this.cache.subscriberCount,
      lastError: this.lastError,
    };
  }

  private async loadBackbone(): Promise<void> {
    const stale = Date.now() - this.scheduleFetchedAt > BACKBONE_TTL_MS;
    if (this.schedule && !stale) return;
    this.schedule = await this.providers.backbone.loadSchedule();
    this.scheduleFetchedAt = Date.now();
  }

  private async doRefresh(): Promise<void> {
    try {
      await this.loadBackbone();
      const base = this.schedule!;
      // Resolve knockout fixtures from the projected bracket so their team-id
      // pairs exist before we try to match live results onto them.
      const { bracket } = computeStandings(base.teams, base.matches);
      const schedule: Schedule = {
        ...base,
        matches: resolveKnockoutFixtures(base.matches, bracket),
      };

      // Seed the scorer cache from the last-good snapshot so restarts keep goals.
      if (!this.goalsSeeded) {
        const prev = this.cache.get();
        if (prev) this.goals.seed(prev.matches);
        this.goalsSeeded = true;
      }

      let providerLabel = this.providers.backbone.name;
      let live = schedule.matches;
      const liveProvider = this.providers.live;
      if (liveProvider && this.liveLimiter.tryAcquire()) {
        // Finished results (so a game's score survives leaving the live feed) + in-play overlay.
        let results: LiveObservation[] = [];
        let refs: MatchRef[] = [];
        if (liveProvider.loadCalendar) {
          ({ results, refs } = await liveProvider.loadCalendar());
        } else if (liveProvider.loadResults) {
          results = await liveProvider.loadResults();
        }
        const observations = [...results, ...(liveProvider.loadLive ? await liveProvider.loadLive() : [])];
        if (observations.length > 0) {
          live = mergeLive(schedule, observations);
          providerLabel = `${this.providers.backbone.name} + ${liveProvider.name}`;
        }
        // Overlay scorers: live games (refreshed) + finished games (backfilled, newest first).
        if (refs.length > 0) {
          await this.goals.update(live, refs, liveProvider, GOAL_FETCH_CONCURRENCY);
          this.indexRefs(live, refs);
        }
      }

      live = this.goals.attach(live);
      const snapshot = buildSnapshot(schedule.teams, live, providerLabel);
      if (this.hasChanged(snapshot)) await this.cache.set(snapshot);
      this.lastError = undefined;
    } catch (err) {
      this.lastError = (err as Error).message;
      console.warn(`[poller] refresh failed: ${this.lastError}`);
    }
  }

  /** Map each resolved fixture to its upstream ref, so match detail can be fetched on demand. */
  private indexRefs(matches: { id: string; home: { teamId?: string }; away: { teamId?: string } }[], refs: MatchRef[]): void {
    const pk = (a?: string, b?: string) => [a, b].filter(Boolean).sort().join('|');
    const byPair = new Map<string, MatchRef>();
    for (const r of refs) if (r.homeCode && r.awayCode) byPair.set(pk(r.homeCode, r.awayCode), r);
    for (const m of matches) {
      if (!m.home.teamId || !m.away.teamId) continue;
      const ref = byPair.get(pk(m.home.teamId, m.away.teamId));
      if (ref) this.fixtureRefs.set(m.id, ref);
    }
  }

  /** Fetch rich detail for one match (lineups, timeline, venue), cached. */
  async getMatchDetail(matchId: string): Promise<MatchDetail | null> {
    const provider = this.providers.live;
    if (!provider?.loadMatchDetail) return null;
    const ref = this.fixtureRefs.get(matchId);
    if (!ref) return null;
    const finished = this.cache.get()?.matches.find((m) => m.id === matchId)?.status === 'finished';
    const ttl = finished ? 24 * 60 * 60_000 : 30_000; // finished detail is static
    const cached = this.detailCache.get(matchId);
    if (cached && Date.now() - cached.at < ttl) return cached.detail;
    try {
      const detail: MatchDetail = { ...(await provider.loadMatchDetail(ref)), matchId };
      this.detailCache.set(matchId, { detail, at: Date.now() });
      return detail;
    } catch (err) {
      console.warn(`[poller] match detail failed: ${(err as Error).message}`);
      return cached?.detail ?? null;
    }
  }

  /** Avoid pushing identical snapshots (the timestamp always differs, so compare the rest). */
  private hasChanged(next: Snapshot): boolean {
    const prev = this.cache.get();
    if (!prev) return true;
    return !sameSnapshot(prev, next);
  }

  private scheduleNext(): void {
    if (this.stopped) return;
    const interval = this.chooseInterval();
    this.timer = setTimeout(() => {
      void this.refresh().finally(() => this.scheduleNext());
    }, interval);
  }

  private chooseInterval(): number {
    const snap = this.cache.get();
    if (snap && snap.status.liveMatchCount > 0) return this.config.pollLiveMs;
    if (snap && nearMatchWindow(snap)) return this.config.pollMatchDayMs;
    return this.config.pollIdleMs;
  }
}

function nearMatchWindow(snap: Snapshot): boolean {
  const now = Date.now();
  return snap.matches.some((m) => {
    if (m.status === 'finished') return false;
    const t = Date.parse(m.kickoff);
    return Number.isFinite(t) && Math.abs(t - now) <= MATCH_WINDOW_MS;
  });
}

/** Structural equality ignoring the generatedAt timestamp. */
function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify({ ...a, generatedAt: '' }) === JSON.stringify({ ...b, generatedAt: '' });
}
