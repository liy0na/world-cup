import { useEffect, useState } from 'react';

export interface VisitorStats {
  totalPageLoads: number;
  todayPageLoads: number;
  currentLiveConnections: number;
  updatedAt?: string;
  privacy: 'aggregate-only';
}

let visitRequest: Promise<VisitorStats | undefined> | undefined;

async function fetchVisitorStats(recordVisit: boolean): Promise<VisitorStats | undefined> {
  const res = await fetch(recordVisit ? '/api/visitors/visit' : '/api/visitors', {
    method: recordVisit ? 'POST' : 'GET',
  });
  if (!res.ok) return undefined;
  return (await res.json()) as VisitorStats;
}

function recordVisitOnce(): Promise<VisitorStats | undefined> {
  visitRequest ??= fetchVisitorStats(true).catch(() => {
    visitRequest = undefined;
    return undefined;
  });
  return visitRequest;
}

export function useVisitorStats(): VisitorStats | undefined {
  const [stats, setStats] = useState<VisitorStats>();

  useEffect(() => {
    let closed = false;

    const apply = (next: VisitorStats | undefined) => {
      if (!closed && next) setStats(next);
    };

    void recordVisitOnce().then(apply);

    const refresh = () => {
      void fetchVisitorStats(false).then(apply).catch(() => undefined);
    };
    const timer = setInterval(refresh, 30_000);

    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, []);

  return stats;
}
