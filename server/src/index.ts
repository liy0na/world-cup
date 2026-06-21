import Fastify from 'fastify';
import { loadConfig } from './config';
import { SnapshotCache } from './core/cache';
import { Poller } from './core/poller';
import { registerRoutes } from './http/routes';
import { createProviders } from './providers';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

  const cache = new SnapshotCache(config.dataDir);
  await cache.load(); // restore last-good snapshot so we render instantly

  const providers = createProviders(config);
  const poller = new Poller(providers, cache, config);

  await registerRoutes(app, {
    cache,
    webDist: config.webDist,
    health: () => poller.health(),
    matchDetail: (id) => poller.getMatchDetail(id),
  });

  await app.listen({ host: config.host, port: config.port });
  app.log.info(`world-cup server on http://${config.host}:${config.port}`);

  // Start polling after the server is accepting connections.
  poller.start().catch((err) => app.log.error(err, 'poller failed to start'));

  const shutdown = async () => {
    poller.stop();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
