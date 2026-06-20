import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  // CommonJS so Fastify's internal dynamic requires + __dirname work once bundled.
  format: ['cjs'],
  target: 'node22',
  platform: 'node',
  // Bundle EVERYTHING (shared workspace, Fastify and its deps, seed JSON) into a
  // single self-contained file so the runtime image needs no node_modules.
  noExternal: [/.*/],
  loader: { '.json': 'json' },
  splitting: false,
  clean: true,
  sourcemap: true,
});
