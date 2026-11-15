'use client'

import { Button } from '@/components/ui/button'
import { RotateCcwIcon, TriangleAlertIcon } from 'lucide-react'

/**
 * Storefront error boundary.
 *
 * Next gives us the failure and a `reset()` that re-renders the segment, which
 * is the only recovery that does not throw away the visitor's cart or scroll
 * position. The digest is shown because it is what a server log is keyed on.
 */
export default function StorefrontError({
   error,
   reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
   return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
         <TriangleAlertIcon className="h-10 w-10 text-foreground/40" aria-hidden />
         <h1 className="text-2xl font-semibold tracking-tight">
            Something went wrong on our side
         </h1>
         <p className="max-w-md text-sm text-foreground/70">
            The page could not finish loading. Nothing was charged and nothing
            was added to your cart. Try again — if it keeps happening, quote this
            reference: <span className="font-mono">{error.digest ?? 'n/a'}</span>
         </p>
         <Button onClick={reset} className="flex gap-2">
            <RotateCcwIcon className="h-4" aria-hidden />
            Try again
         </Button>
      </div>
   )
}
