'use client'

import { Button } from '@/components/admin/ui/button'
import { RotateCcwIcon, ShieldAlertIcon } from 'lucide-react'
import Link from 'next/link'

/**
 * Admin error boundary. Deliberately quieter than the storefront one: an admin
 * needs the digest and a way back to a screen that works, not reassurance copy.
 */
export default function AdminError({
   error,
   reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
   return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
         <ShieldAlertIcon className="h-10 w-10 text-foreground/40" aria-hidden />
         <h1 className="text-2xl font-semibold tracking-tight">
            This admin screen failed to render
         </h1>
         <p className="max-w-md text-sm text-foreground/70">
            The action was not applied. Reference:{' '}
            <span className="font-mono">{error.digest ?? 'n/a'}</span>
         </p>
         <div className="flex gap-2">
            <Button onClick={reset} className="flex gap-2">
               <RotateCcwIcon className="h-4" aria-hidden />
               Retry
            </Button>
            <Button asChild variant="outline">
               <Link href="/admin">Dashboard</Link>
            </Button>
         </div>
      </div>
   )
}
