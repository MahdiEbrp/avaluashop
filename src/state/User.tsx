'use client'

import { useAuthenticated } from '@/hooks/useAuthentication'
import { isVariableValid } from '@/lib/utils'
import React, { createContext, useContext, useEffect, useState } from 'react'

const UserContext = createContext({
   user: null,
   loading: true,
   refreshUser: () => {
      /* nothing to refresh */
   },
})

export const useUserContext = () => {
   return useContext(UserContext)
}

export const UserContextProvider = ({ children }) => {
   const { authenticated } = useAuthenticated()

   const [user, setUser] = useState(null)

   const refreshUser = async () => {
      try {
         if (!authenticated) return

         const response = await fetch(`/api/profile`, {
            cache: 'no-store',
         })

         const json = await response.json()

         if (isVariableValid(json)) setUser(json)
      } catch (error) {
         console.error({ error })
      }
   }

   useEffect(() => {
      if (!authenticated) return

      let cancelled = false

      async function fetchProfile() {
         try {
            const response = await fetch(`/api/profile`, {
               cache: 'no-store',
            })

            const json = await response.json()

            if (!cancelled && isVariableValid(json)) setUser(json)
         } catch (error) {
            console.error({ error })
         }
      }

      void fetchProfile()

      return () => {
         cancelled = true
      }
   }, [authenticated])

   /* Derived rather than stored: a signed-in visitor is loading until the
      profile lands, a guest never is. Storing it meant a synchronous
      setState in the effect above. */
   const loading = authenticated && user === null

   /* The provider advertises a fire-and-forget refresh: callers re-render from
      `user`, they never await the fetch. */
   const refresh = () => {
      void refreshUser()
   }

   return (
      <UserContext.Provider value={{ user, loading, refreshUser: refresh }}>
         {children}
      </UserContext.Provider>
   )
}
