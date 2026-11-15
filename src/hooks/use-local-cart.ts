'use client'

import { type LocalCart, getLocalCart, writeLocalCart } from '@/lib/cart'
import { useSyncExternalStore } from 'react'

const CART_EVENT = 'avaluashop:local-cart'

/* getSnapshot has to return a referentially stable value or React re-renders
   forever, hence the cache. `undefined` doubles as "not read yet". */
let cached: LocalCart | undefined

function invalidate() {
   cached = undefined
}

function subscribe(onStoreChange: () => void) {
   const handle = () => {
      invalidate()
      onStoreChange()
   }

   globalThis.addEventListener(CART_EVENT, handle)
   globalThis.addEventListener('storage', handle)

   return () => {
      globalThis.removeEventListener(CART_EVENT, handle)
      globalThis.removeEventListener('storage', handle)
   }
}

function getSnapshot() {
   if (cached === undefined) {
      const stored = getLocalCart()
      cached = stored && Array.isArray(stored.items) ? stored : { items: [] }
   }

   return cached
}

const getServerSnapshot = () => null

/** Writes the guest cart and notifies every subscriber. */
export function publishLocalCart(cart: LocalCart) {
   writeLocalCart(cart)
   invalidate()
   globalThis.dispatchEvent(new Event(CART_EVENT))
}

/** The guest cart, read live from localStorage (null while server rendering). */
export function useLocalCart() {
   return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
