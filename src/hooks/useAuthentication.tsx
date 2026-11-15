'use client'

import { useSyncExternalStore } from 'react'

const unsubscribe = () => {
   /* nothing to release: the cookie is read on demand */
}

const subscribe = () => unsubscribe

function isLoggedInCookie() {
   try {
      return document.cookie
         .split(';')
         .some((cookie) => cookie.trim() === 'logged-in=true')
   } catch (error) {
      console.error({ error })
      return false
   }
}

/**
 * Whether the visitor holds a `logged-in=true` cookie.
 *
 * Read synchronously through useSyncExternalStore rather than in an effect:
 * the previous version rendered once with `false` and only corrected itself
 * after mount, which made guards flash the login page.
 *
 * The server snapshot stays `false` so hydration matches; the real value
 * arrives on the first client render afterwards.
 */
export function useAuthenticated() {
   const authenticated = useSyncExternalStore(
      subscribe,
      isLoggedInCookie,
      () => false
   )

   return { authenticated }
}
