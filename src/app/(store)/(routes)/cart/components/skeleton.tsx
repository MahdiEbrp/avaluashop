'use client'

import { ImageSkeleton } from '@/components/native/icons'

export function Skeleton() {
   return (
      <div className="animate-pulse rounded-lg border border-border bg-card mb-4">
         <div className="relative h-full w-full">
            <div className="flex h-40 w-full items-center justify-center rounded bg-muted ">
               <ImageSkeleton />
            </div>
         </div>
         <div className="p-5">
            <div className="w-full">
               <div className="mb-4 h-2.5 w-48 rounded-full bg-muted"></div>
               <div className="mb-2.5 h-2 max-w-120 rounded-full bg-muted"></div>
               <div className="mb-2.5 h-2 rounded-full bg-muted"></div>
               <div className="mb-2.5 h-2 max-w-110 rounded-full bg-muted"></div>
               <div className="mb-2.5 h-2 max-w-115 rounded-full bg-muted"></div>
               <div className="h-2 max-w-90 rounded-full bg-muted"></div>
            </div>
         </div>
      </div>
   )
}
