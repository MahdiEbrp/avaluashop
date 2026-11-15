'use client'

import { useSyncExternalStore } from 'react'

/* The set of subscribers is irrelevant: the answer flips once, at hydration,
   and never changes again. What matters is that the server snapshot and the
   client snapshot differ, which is exactly what useSyncExternalStore is for. */
const unsubscribe = () => {
   /* nothing to release: the snapshot is a constant */
}

const subscribe = () => unsubscribe

const getClientSnapshot = () => true
const getServerSnapshot = () => false

/**
 * True after hydration, false during server rendering.
 *
 * This is the supported replacement for the `useState(false)` +
 * `useEffect(() => setMounted(true), [])` idiom. That idiom costs an extra
 * render pass and trips `react-hooks/set-state-in-effect`.
 */
export function useIsClient() {
   return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}
