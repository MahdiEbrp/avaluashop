'use client'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { MenuIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

const links = [
   { title: 'صفحه اصلی', href: '/' },
   { title: 'فروشگاه اکسسوری', href: '/products' },
   { title: 'درباره آوالوا', href: '/about' },
   { title: 'تماس با ما', href: '/contact' },
   { title: 'سوالات متداول', href: '/faq' },
]

export function MobileNav() {
   const [open, setOpen] = useState(false)

   return (
      <Sheet open={open} onOpenChange={setOpen}>
         <SheetTrigger asChild>
            <Button
               variant="outline"
               size="icon"
               className="me-2 h-10 w-10 shrink-0 rounded-xl md:hidden"
               aria-label="باز کردن منو"
            >
               <MenuIcon className="h-5 w-5" />
            </Button>
         </SheetTrigger>
         <SheetContent side="right" dir="rtl" className="w-[min(86vw,360px)]">
            <div className="mb-6 text-right text-lg font-bold">آوالوا</div>
            <ScrollArea className="h-[calc(100vh-7rem)] pe-3">
               <nav className="flex flex-col gap-1 text-right">
                  {links.map((item) => (
                     <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                     >
                        {item.title}
                     </Link>
                  ))}
               </nav>
            </ScrollArea>
         </SheetContent>
      </Sheet>
   )
}
