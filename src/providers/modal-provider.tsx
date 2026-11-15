'use client'

import { useIsClient } from '@/hooks/use-is-client'

export const ModalProvider = () => {
   const isMounted = useIsClient()

   if (!isMounted) {
      return null
   }

   return <></>
}
