'use client'

import { Button } from '@/components/ui/button'
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
} from '@/components/ui/command'
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from '@/components/ui/popover'
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSyncedState } from '@/hooks/use-synced-state'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

export function SortBy({ initialData }) {
   const router = useRouter()
   const pathname = usePathname()
   const searchParams = useSearchParams()
   const [value, setValue] = useSyncedState<string>(initialData || 'featured')

   return (
      <Select
         dir="rtl"
         value={value}
         onValueChange={(nextValue) => {
            const current = new URLSearchParams(searchParams.toString())
            current.set('sort', nextValue)
            current.delete('page')
            setValue(nextValue)
            router.replace(`${pathname}?${current.toString()}`, { scroll: false })
         }}
      >
         <SelectTrigger className="w-full" dir="rtl">
            <SelectValue placeholder="مرتب‌سازی" />
         </SelectTrigger>
         <SelectContent dir="rtl">
            <SelectItem value="featured">پیشنهادی</SelectItem>
            <SelectItem value="most_expensive">گران‌ترین</SelectItem>
            <SelectItem value="least_expensive">ارزان‌ترین</SelectItem>
         </SelectContent>
      </Select>
   )
}

export function CategoriesCombobox({ categories, initialCategory }) {
   const router = useRouter()
   const pathname = usePathname()
   const searchParams = useSearchParams()
   const [open, setOpen] = React.useState(false)
   const [value, setValue] = useSyncedState<string>(initialCategory || '')

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <Button
               variant="outline"
               role="combobox"
               aria-expanded={open}
               className="w-full justify-between"
               dir="rtl"
            >
               <span>{value || 'همه دسته‌ها'}</span>
               <ChevronsUpDown className="me-2 h-4 shrink-0 opacity-50" />
            </Button>
         </PopoverTrigger>
         <PopoverContent className="w-full p-0" dir="rtl">
            <Command dir="rtl">
               <CommandInput placeholder="جستجوی دسته‌بندی..." />
               <CommandEmpty>دسته‌ای پیدا نشد.</CommandEmpty>
               <CommandGroup>
                  {categories.map((category) => (
                     <CommandItem
                        key={category.id}
                        value={category.title}
                        onSelect={(selected) => {
                           const current = new URLSearchParams(searchParams.toString())
                           if (selected === value) {
                              current.delete('category')
                              setValue('')
                           } else {
                              current.set('category', selected)
                              setValue(selected)
                           }
                           current.delete('page')
                           const query = current.toString()
                           router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
                           setOpen(false)
                        }}
                     >
                        <Check className={cn('me-2 h-4 w-4', value === category.title ? 'opacity-100' : 'opacity-0')} />
                        {category.title}
                     </CommandItem>
                  ))}
               </CommandGroup>
            </Command>
         </PopoverContent>
      </Popover>
   )
}

export function AvailableToggle({ initialData }) {
   const router = useRouter()
   const pathname = usePathname()
   const searchParams = useSearchParams()
   const [value, setValue] = useSyncedState<boolean>(initialData === 'true')

   return (
      <div className="flex min-h-10 w-full items-center justify-center gap-3 rounded-md border border-border px-3" dir="rtl">
         <Switch
            dir="rtl"
            checked={value}
            onCheckedChange={(checked: boolean) => {
               const current = new URLSearchParams(searchParams.toString())
               current.set('isAvailable', String(checked))
               current.delete('page')
               setValue(checked)
               router.replace(`${pathname}?${current.toString()}`, { scroll: false })
            }}
            id="available"
         />
         <label htmlFor="available" className="text-sm">فقط کالاهای موجود</label>
      </div>
   )
}
