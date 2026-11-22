'use client'

import { cn } from '@/lib/utils'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'

interface CarouselProps {
   images: string[]
   alt?: string
}

export default function Carousel({
   images,
   alt = 'تصویر محصول',
}: Readonly<CarouselProps>) {
   const [emblaRef, emblaApi] = useEmblaCarousel({ loop: images.length > 1 })
   const [selectedIndex, setSelectedIndex] = useState(0)

   useEffect(() => {
      function selectHandler() {
         const index = emblaApi?.selectedScrollSnap()
         setSelectedIndex(index || 0)
      }

      emblaApi?.on('select', selectHandler)

      return () => {
         emblaApi?.off('select', selectHandler)
      }
   }, [emblaApi])

   if (images.length === 0) {
      return (
         <div className="flex h-96 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary text-sm text-muted-foreground">
            تصویری برای این محصول ثبت نشده است.
         </div>
      )
   }

   return (
      <div className="relative">
         <div
            className="overflow-hidden rounded-2xl border border-border/70 bg-card"
            ref={emblaRef}
         >
            <div className="flex">
               {images.map((src, index) => (
                  <div
                     className="relative aspect-square min-h-80 shrink-0 grow-0 basis-full bg-secondary"
                     key={`${src}-${index}`}
                  >
                     <Image
                        src={src}
                        fill
                        sizes="(min-width: 768px) 40vw, 100vw"
                        className="object-contain p-3"
                        alt={`${alt}، تصویر ${index + 1}`}
                        priority={index === 0}
                     />
                  </div>
               ))}
            </div>
         </div>

         {images.length > 1 ? (
            <>
               <button
                  type="button"
                  onClick={() => { emblaApi?.scrollPrev() }}
                  aria-label="تصویر قبلی"
                  className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-border bg-background/90 text-foreground shadow-sm transition hover:bg-background"
               >
                  <ChevronRightIcon className="h-5 w-5" />
               </button>
               <button
                  type="button"
                  onClick={() => { emblaApi?.scrollNext() }}
                  aria-label="تصویر بعدی"
                  className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-border bg-background/90 text-foreground shadow-sm transition hover:bg-background"
               >
                  <ChevronLeftIcon className="h-5 w-5" />
               </button>
            </>
         ) : null}

         <div
            className="mt-4 flex flex-wrap justify-center gap-2"
            aria-label="انتخاب تصویر محصول"
         >
            {images.map((src, index) => {
               const selected = index === selectedIndex
               return (
                  <div
                     key={`${src}-dot-${index}`}
                     className={cn(
                        'h-3 w-3 rounded-full transition-all duration-300 bg-primary-foreground',
                        !selected && 'opacity-50'
                     )}
                  />
               )
            })}
         </div>
      </div>
   )
}
