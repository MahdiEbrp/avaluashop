'use client'

import { Button } from '@/components/ui/button'
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuGroup,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
   CreditCardIcon,
   HeartIcon,
   ListOrderedIcon,
   LogOutIcon,
   MapPinIcon,
   ShoppingBasketIcon,
   UserIcon,
} from 'lucide-react'
import Link from 'next/link'

async function logOut() {
   try {
      const response = await fetch('/api/auth/logout', { cache: 'no-store' })
      if (response.status === 200) globalThis.location.reload()
   } catch (error) {
      console.error({ error })
   }
}

export function UserNav() {
   return (
      <DropdownMenu dir="rtl">
         <DropdownMenuTrigger asChild>
            <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl" aria-label="حساب کاربری">
               <UserIcon className="h-4 w-4" />
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuGroup>
               <Link href="/profile/addresses">
                  <DropdownMenuItem className="flex gap-2">
                     <MapPinIcon className="me-2 h-4 w-4" />
                     نشانی‌های من
                  </DropdownMenuItem>
               </Link>
               <Link href="/profile/edit">
                  <DropdownMenuItem className="flex gap-2">
                     <UserIcon className="me-2 h-4 w-4" />
                     ویرایش حساب کاربری
                  </DropdownMenuItem>
               </Link>
               <Link href="/profile/orders">
                  <DropdownMenuItem className="flex gap-2">
                     <ListOrderedIcon className="me-2 h-4 w-4" />
                     سفارش‌های من
                  </DropdownMenuItem>
               </Link>
               <Link href="/profile/payments">
                  <DropdownMenuItem className="flex gap-2">
                     <CreditCardIcon className="me-2 h-4 w-4" />
                     پرداخت‌ها
                  </DropdownMenuItem>
               </Link>
               <DropdownMenuSeparator />
               <Link href="/cart">
                  <DropdownMenuItem className="flex gap-2">
                     <ShoppingBasketIcon className="me-2 h-4 w-4" />
                     سبد خرید
                  </DropdownMenuItem>
               </Link>
               <Link href="/wishlist">
                  <DropdownMenuItem className="flex gap-2">
                     <HeartIcon className="me-2 h-4 w-4" />
                     علاقه‌مندی‌ها
                  </DropdownMenuItem>
               </Link>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex gap-2" onClick={() => void logOut()}>
               <LogOutIcon className="me-2 h-4 w-4" />
               خروج از حساب
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   )
}
