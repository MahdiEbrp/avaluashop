'use client'

import { Button } from '@/components/admin/ui/button'
import { LogOutIcon } from 'lucide-react'

async function logOut() {
   try {
      const response = await fetch('/api/admin/auth/logout', {
         cache: 'no-store',
      })

      if (response.status === 200) globalThis.location.reload()
   } catch (error) {
      console.error({ error })
   }
}

export function LogoutButton() {
   return (
      <Button variant="outline" size="icon" onClick={() => void logOut()}>
         <LogOutIcon className="h-4" />
      </Button>
   )
}
