'use client'

import { useState } from 'react'

/**
 * Local state that resets when `source` changes.
 *
 * React's documented pattern for "adjusting state when a prop changes" — compare
 * against the value from the previous render and update during render, instead
 * of running an effect that calls setState (which renders twice and is what
 * `react-hooks/set-state-in-effect` exists to prevent).
 *
 *   const [value, setValue] = useSyncedState(initialValue)
 *
 * `source` is compared by identity, matching how the previous `[source]`
 * dependency array behaved.
 */
export function useSyncedState<T>(source: T) {
   const [value, setValue] = useState<T>(source)
   const [previousSource, setPreviousSource] = useState<T>(source)

   if (!Object.is(previousSource, source)) {
      setPreviousSource(source)
      setValue(source)
   }

   return [value, setValue] as const
}
