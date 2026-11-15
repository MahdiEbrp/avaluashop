import { useSyncExternalStore } from 'react'

/* The origin never changes during a session, so there is nothing to subscribe
   to — only a server snapshot that has to be empty for hydration to match. */
const unsubscribe = () => {
   /* nothing to release: the origin is a constant */
}

const subscribe = () => unsubscribe

const getOrigin = () => globalThis.location.origin
const getServerOrigin = () => ''

export const useOrigin = () =>
   useSyncExternalStore(subscribe, getOrigin, getServerOrigin)
