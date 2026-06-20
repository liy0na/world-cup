import { useEffect, useState } from 'react';
import type { Snapshot } from '@wc/shared';

export type ConnectionStatus = 'connecting' | 'live' | 'polling' | 'offline';

export interface LiveState {
  snapshot?: Snapshot;
  status: ConnectionStatus;
}

/**
 * Subscribe to the server's snapshot stream over SSE, falling back to polling
 * /api/state every 15s if the event stream cannot be established. The browser
 * only ever talks to our own server — never the upstream football API.
 */
export function useLiveState(): LiveState {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    let closed = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let es: EventSource | undefined;

    const apply = (data: string) => {
      try {
        if (!closed) setSnapshot(JSON.parse(data) as Snapshot);
      } catch {
        /* ignore malformed frame */
      }
    };

    const poll = async () => {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          setSnapshot((await res.json()) as Snapshot);
          if (!closed) setStatus((s) => (s === 'live' ? s : 'polling'));
        }
      } catch {
        if (!closed) setStatus('offline');
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      void poll();
      pollTimer = setInterval(poll, 15_000);
    };
    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = undefined;
    };

    // Initial snapshot so the UI paints before the stream connects.
    void poll();

    try {
      es = new EventSource('/api/stream');
      es.addEventListener('open', () => {
        if (closed) return;
        stopPolling();
        setStatus('live');
      });
      es.addEventListener('snapshot', (e) => {
        apply((e as MessageEvent).data);
        if (!closed) setStatus('live');
      });
      es.addEventListener('error', () => {
        if (closed) return;
        if (es?.readyState === EventSource.CLOSED) startPolling();
        else setStatus('connecting');
      });
    } catch {
      startPolling();
    }

    return () => {
      closed = true;
      es?.close();
      stopPolling();
    };
  }, []);

  return { snapshot, status };
}
