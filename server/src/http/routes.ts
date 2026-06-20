import { existsSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type { SnapshotCache } from '../core/cache';

const HEARTBEAT_MS = 25_000;

export interface RouteDeps {
  cache: SnapshotCache;
  webDist: string;
  /** Optional liveness info surfaced on /api/health. */
  health: () => Record<string, unknown>;
}

export async function registerRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { cache } = deps;

  app.get('/api/health', () => ({ ok: true, ...deps.health() }));

  // Current snapshot. The poller fills this within a second of boot; until then
  // (and with no last-good disk copy) we report "warming up".
  app.get('/api/state', (_req, reply) => {
    const snap = cache.get();
    if (!snap) return reply.code(503).send({ error: 'warming up' });
    return reply.send(snap);
  });

  // SSE: push the current snapshot immediately, then every change, plus a
  // heartbeat so reverse proxies (Traefik) don't drop the idle stream.
  app.get('/api/stream', (req, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (snap: unknown) => {
      const payload = snap as { generatedAt?: string };
      res.write(`id: ${payload.generatedAt ?? ''}\nevent: snapshot\ndata: ${JSON.stringify(snap)}\n\n`);
    };

    const current = cache.get();
    if (current) send(current);

    const unsubscribe = cache.subscribe(send);
    const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), HEARTBEAT_MS);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // Serve the built SPA (when present) with history-API fallback.
  if (existsSync(deps.webDist)) {
    const fastifyStatic = (await import('@fastify/static')).default;
    await app.register(fastifyStatic, { root: deps.webDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: 'not found' });
    });
    app.log.info(`serving SPA from ${deps.webDist}`);
  } else {
    app.log.warn(`web dist not found at ${deps.webDist} — API only (use the Vite dev server for UI)`);
  }
}
