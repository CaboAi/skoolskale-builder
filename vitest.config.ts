import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    // userEvent-driven DOM tests do <100ms of real work each, but under the
    // full suite's parallel fork load (one fork per core, each booting jsdom)
    // their wall-clock can spike past the vitest 5s default and time out —
    // a scheduling-latency flake, not a hang (the same tests pass in
    // isolation and the whole suite is green with --no-file-parallelism).
    // 15s is generous headroom that absorbs the contention while still
    // failing fast on a genuine infinite loop.
    testTimeout: 15_000,
    // Default environment is node. DOM-dependent tests under tests/dom/**
    // opt in via the `// @vitest-environment jsdom` pragma at the top of
    // each file. This keeps the existing node-based tests fast (no jsdom
    // boot for unit/schema/integration suites) while enabling component
    // tests where they're needed.
    environment: 'node',
    globals: false,
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    setupFiles: ['tests/setup.ts', 'tests/setup-dom.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'server-only': resolve(__dirname, 'tests/server-only-shim.ts'),
    },
  },
});
