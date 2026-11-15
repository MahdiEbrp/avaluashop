'use client'

import { publishLocalCart, useLocalCart } from '@/hooks/use-local-cart'
import { isVariableValid } from '@/lib/utils'
import { useUserContext } from '@/state/User'
import React, { createContext, useContext, useState } from 'react'

const CartContext = createContext({
   cart: null,
   loading: true,
   /* The default context is inert: every consumer sits under the provider. */
   refreshCart: () => {
      /* nothing to refresh */
   },
   dispatchCart: (_next: unknown) => {
      /* nothing to dispatch */
   },
})

export const useCartContext = () => {
   return useContext(CartContext)
}

export const CartContextProvider = ({ children }) => {
   const { user } = useUserContext()

   /* Guests: read live from localStorage through useSyncExternalStore, so no
      effect has to copy it into state. */
   const localCart = useLocalCart()

   /* Signed in: adopt the server copy during render — React's documented
      "adjust state when a prop changes" pattern — instead of an effect. */
   const [serverCart, setServerCart] = useState(null)
   const [syncedUser, setSyncedUser] = useState(null)

   if (isVariableValid(user) && user !== syncedUser) {
      setSyncedUser(user)
      setServerCart(user.cart)
   }

   const cart = isVariableValid(user) ? (serverCart ?? user.cart) : localCart

   const dispatchCart = (next) => {
      // Optimistic: show it right away and mirror it for the guest store.
      setServerCart(next)
      publishLocalCart(next)
   }

   const refreshCart = () => {
      if (isVariableValid(user)) setServerCart(user.cart)
   }

   const loading = cart === null

   return (
      <CartContext.Provider
         value={{ cart, loading, refreshCart, dispatchCart }}
      >
         {children}
      </CartContext.Provider>
   )
}
