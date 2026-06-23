import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface VisitorStore {
  totalPageLoads: number;
  dailyPageLoads: Record<string, number>;
  updatedAt?: string;
}

export interface VisitorSnapshot {
  totalPageLoads: number;
  todayPageLoads: number;
  currentLiveConnections: number;
  updatedAt?: string;
  privacy: 'aggregate-only';
}

const emptyStore = (): VisitorStore => ({
  totalPageLoads: 0,
  dailyPageLoads: {},
});

const dayKey = (now = new Date()): string => now.toISOString().slice(0, 10);

const cleanCount = (value: unknown): number => {
  const n = typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

/**
 * Aggregate-only visitor stats. This intentionally stores no IPs, user agents,
 * cookies, referrers, or per-browser identifiers.
 */
export class VisitorStats {
  private readonly file: string;
  private store: VisitorStore = emptyStore();
  private currentLiveConnections = 0;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.file = join(dataDir, 'visitors.json');
  }

  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8')) as Partial<VisitorStore>;
      const next = emptyStore();
      next.totalPageLoads = cleanCount(parsed.totalPageLoads);
      if (parsed.dailyPageLoads && typeof parsed.dailyPageLoads === 'object') {
        for (const [day, count] of Object.entries(parsed.dailyPageLoads)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(day)) next.dailyPageLoads[day] = cleanCount(count);
        }
      }
      if (typeof parsed.updatedAt === 'string') next.updatedAt = parsed.updatedAt;
      this.store = next;
      console.log(`[visitors] restored aggregate counters from ${this.file}`);
    } catch {
      // No previous aggregate stats yet, or the file is unreadable. Start fresh.
    }
  }

  async recordPageLoad(now = new Date()): Promise<VisitorSnapshot> {
    const key = dayKey(now);
    this.store.totalPageLoads += 1;
    this.store.dailyPageLoads[key] = (this.store.dailyPageLoads[key] ?? 0) + 1;
    this.store.updatedAt = now.toISOString();
    await this.persist();
    return this.snapshot(now);
  }

  openLiveConnection(): VisitorSnapshot {
    this.currentLiveConnections += 1;
    return this.snapshot();
  }

  closeLiveConnection(): VisitorSnapshot {
    this.currentLiveConnections = Math.max(0, this.currentLiveConnections - 1);
    return this.snapshot();
  }

  snapshot(now = new Date()): VisitorSnapshot {
    return {
      totalPageLoads: this.store.totalPageLoads,
      todayPageLoads: this.store.dailyPageLoads[dayKey(now)] ?? 0,
      currentLiveConnections: this.currentLiveConnections,
      updatedAt: this.store.updatedAt,
      privacy: 'aggregate-only',
    };
  }

  private async persist(): Promise<void> {
    const payload = JSON.stringify(this.store, null, 2);
    this.writeChain = this.writeChain.catch(() => undefined).then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, payload, 'utf8');
      await rename(tmp, this.file);
    });
    await this.writeChain;
  }
}
