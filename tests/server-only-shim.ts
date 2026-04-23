// Stand-in for `server-only` in Vitest. The real package throws on import
// from client contexts; in tests we're neither server nor client, so no-op.
export {};
