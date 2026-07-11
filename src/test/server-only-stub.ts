// Test-only stub for the `server-only` package. In Next.js, importing
// `server-only` throws if the module is ever pulled into a client bundle —
// that guard doesn't apply (and actively gets in the way) inside Vitest's
// plain Node test environment, so vitest.config.ts aliases `server-only`
// to this no-op for tests only. Production builds still use the real
// package via Next.js's own module resolution.
export {};
