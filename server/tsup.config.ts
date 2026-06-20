import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  // Bundle the shared workspace (it ships TS source, not a build) and inline
  // the seed JSON so the runtime image is a single self-contained file.
  noExternal: ['@wc/shared'],
  loader: { '.json': 'json' },
  clean: true,
  sourcemap: true,
});
