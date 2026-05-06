import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
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
