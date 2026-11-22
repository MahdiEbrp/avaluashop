'use client'

import { cn } from '@/lib/utils'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'

interface CarouselProps {
   images: string[]
   alt?: string
}

export default function Carousel({ images, alt = 'تصویر محصول' }: Readonly<CarouselProps>) {
   const [emblaRef, emblaApi] = useEmblaCarousel({ loop: images.length > 1 })
   const [selectedIndex, setSelectedIndex] = useState(0)
   const [canScrollPrev, setCanScrollPrev] = useState(false)
   const [canScrollNext, setCanScrollNext] = useState(false)

   const onSelect = useCallback(() => {
      if (!emblaApi) return
      setSelectedIndex(emblaApi.selectedScrollSnap())
      setCanScrollPrev(emblaApi.canScrollPrev())
      setCanScrollNext(emblaApi.canScrollNext())
   }, [emblaApi])

   useEffect(() => {
      if (!emblaApi) return
      onSelect()
      emblaApi.on('select', onSelect)
      emblaApi.on('reInit', onSelect)
      return () => {
         emblaApi.off('select', onSelect)
         emblaApi.off('reInit', onSelect)
      }
   }, [emblaApi, onSelect])

   if (images.length === 0) {
      return (
         <div className="flex h-96 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary text-sm text-muted-foreground">
            تصویری برای این محصول ثبت نشده است.
         </div>
      )
   }

   return (
      <div className="relative">
         <div className="overflow-hidden rounded-2xl border border-border/70 bg-card" ref={emblaRef}>
            <div className="flex">
               {images.map((src, index) => (
                  <div className="relative aspect-[4/5] min-h-80 shrink-0 grow-0 basis-full bg-secondary" key={`${src}-${index}`}>
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
                  onClick={() => emblaApi?.scrollPrev()}
                  disabled={!canScrollPrev}
                  aria-label="تصویر قبلی"
                  className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm transition hover:bg-background disabled:opacity-40"
               >
                  <ChevronRightIcon className="h-5 w-5" />
               </button>
               <button
                  type="button"
                  onClick={() => emblaApi?.scrollNext()}
                  disabled={!canScrollNext}
                  aria-label="تصویر بعدی"
                  className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm transition hover:bg-background disabled:opacity-40"
               >
                  <ChevronLeftIcon className="h-5 w-5" />
               </button>
               <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="انتخاب تصویر محصول">
                  {images.map((src, index) => (
                     <button
                        key={`${src}-dot-${index}`}
                        type="button"
                        onClick={() => emblaApi?.scrollTo(index)}
                        aria-label={`نمایش تصویر ${index + 1}`}
                        aria-pressed={selectedIndex === index}
                        className={cn(
                           'h-2.5 rounded-full transition-all',
                           selectedIndex === index ? 'w-7 bg-primary' : 'w-2.5 bg-primary/25 hover:bg-primary/50'
                        )}
                     />
                  ))}
               </div>
            </>
         ) : null}
      </div>
   )
}
