'use client'

import { Button } from '@/components/ui/button'
import {
   CommandDialog,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from '@/components/ui/command'
import { SearchIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as React from 'react'

const pages = [
   { title: 'صفحه اصلی', href: '/' },
   { title: 'فروشگاه اکسسوری', href: '/products' },
   { title: 'درباره آوالونا شاپ', href: '/about' },
   { title: 'تماس با ما', href: '/contact' },
   { title: 'سوالات متداول', href: '/faq' },
]

export function CommandMenu(
   props: Readonly<React.ComponentProps<typeof CommandDialog>>
) {
   const router = useRouter()
   const [open, setOpen] = React.useState(false)

   React.useEffect(() => {
      const down = (event: KeyboardEvent) => {
         if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            setOpen((current) => !current)
         }
      }
      document.addEventListener('keydown', down)
      return () => { document.removeEventListener('keydown', down); }
   }, [])

   return (
      <>
         <Button
            variant="search"
            aria-label="جستجو در فروشگاه"
            className="h-10 w-10 shrink-0 px-0 sm:w-40 sm:justify-start sm:gap-2 sm:px-3 lg:w-64"
            onClick={() => { setOpen(true); }}
            {...props}
         >
            <SearchIcon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">جستجو در آوالونا شاپ</span>
         </Button>
         <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput dir="rtl" placeholder="نام محصول یا صفحه را جستجو کنید..." />
            <CommandList dir="rtl">
               <CommandEmpty>موردی پیدا نشد.</CommandEmpty>
               <CommandGroup heading="صفحات فروشگاه">
                  {pages.map((page) => (
                     <CommandItem
                        key={page.href}
                        value={page.title}
                        onSelect={() => {
                           setOpen(false)
                           router.push(page.href)
                        }}
                     >
                        {page.title}
                     </CommandItem>
                  ))}
               </CommandGroup>
            </CommandList>
         </CommandDialog>
      </>
   )
}
