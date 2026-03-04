import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
});
