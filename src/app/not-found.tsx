import { Button } from '@/components/ui/button'
import { CompassIcon } from 'lucide-react'
import Link from 'next/link'

/* A 404 that keeps the visitor inside the shop instead of dead-ending. */
export default function NotFound() {
   return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
         <CompassIcon className="h-10 w-10 text-foreground/40" aria-hidden />
         <h1 className="text-2xl font-semibold tracking-tight">
            This page is not in the catalogue
         </h1>
         <p className="max-w-md text-sm text-foreground/70">
            The link may be out of date, or the product may have been retired.
            Everything still on sale is one click away.
         </p>
         <div className="flex gap-2">
            <Button asChild>
               <Link href="/products">Browse products</Link>
            </Button>
            <Button asChild variant="outline">
               <Link href="/">Back to the storefront</Link>
            </Button>
         </div>
      </div>
   )
}
