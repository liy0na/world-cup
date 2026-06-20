import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Snapshot } from '@wc/shared';

type Listener = (snapshot: Snapshot) => void;

/**
 * Single source of truth for the current snapshot. Holds it in memory, persists
 * a last-good copy to disk (so restarts render instantly without burning fresh
 * upstream calls), and fans changes out to SSE subscribers.
 */
export class SnapshotCache {
  private current: Snapshot | undefined;
  private readonly file: string;
  private readonly listeners = new Set<Listener>();

  constructor(dataDir: string) {
    this.file = join(dataDir, 'snapshot.json');
  }

  /** Restore the last-good snapshot from disk, if any. */
  async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, 'utf8');
      this.current = JSON.parse(raw) as Snapshot;
      console.log(`[cache] restored snapshot from ${this.file} (${this.current.generatedAt})`);
    } catch {
      // No prior snapshot — fine on first run.
    }
  }

  get(): Snapshot | undefined {
    return this.current;
  }

  /** Replace the snapshot, persist it, and notify subscribers. */
  async set(snapshot: Snapshot): Promise<void> {
    this.current = snapshot;
    await this.persist(snapshot);
    for (const fn of this.listeners) {
      try {
        fn(snapshot);
      } catch (err) {
        console.warn(`[cache] listener error: ${(err as Error).message}`);
      }
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get subscriberCount(): number {
    return this.listeners.size;
  }

  private async persist(snapshot: Snapshot): Promise<void> {
    try {
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, JSON.stringify(snapshot), 'utf8');
      await rename(tmp, this.file); // atomic replace
    } catch (err) {
      console.warn(`[cache] persist failed: ${(err as Error).message}`);
    }
  }
}
