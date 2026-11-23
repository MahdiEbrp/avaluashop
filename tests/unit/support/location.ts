import { vi } from 'vitest'

const SNAPSHOT_FIELDS = ['href', 'origin', 'protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash'] as const

/**
 * Replaces `window.location` with a plain object holding the current string
 * fields plus the given overrides (e.g. a stubbed `assign` or `reload`).
 */
export function stubLocation(overrides: Partial<Location> = {}) {
   /* Server-project tests run without a window, so there may be nothing to copy. */
   const base: Partial<Location> | undefined = globalThis.location
   const snapshot = Object.fromEntries(SNAPSHOT_FIELDS.map((field) => [field, base?.[field]]))

   vi.stubGlobal('location', { ...snapshot, ...overrides })
}
