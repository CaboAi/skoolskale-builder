/**
 * DOM-test setup. Loaded for every vitest run because the matchers it
 * registers are no-ops under node — they only become useful when a test
 * file opts into jsdom via the `// @vitest-environment jsdom` pragma.
 *
 * Do not move DOM-only browser polyfills here without a jsdom guard;
 * importing browser-only globals at module scope would crash node-env tests.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Auto-cleanup between tests. RTL's built-in afterEach hook only fires when
// vitest is in `globals: true` mode (it isn't), so register it explicitly.
// Cleanup is a no-op when no React tree is mounted, so node-env tests don't
// pay anything for this.
afterEach(() => {
  cleanup();
});
