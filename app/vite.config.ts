/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { offline } from './build/offline-plugin.ts';

export default defineConfig({
  // Relative asset URLs: the same build works at any sub-path (e.g. /openinfinite/).
  base: './',
  plugins: [react(), offline()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 300_000,
    // tests/topics.test.ts discovers packs and verifiers with import.meta.glob;
    // a cached transform would miss newly added files.
    fsModuleCache: false,
  },
});
