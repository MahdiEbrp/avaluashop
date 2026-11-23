'use client'

import { CommandMenu } from '@/components/composites/command'
import { MobileNav } from '@/components/native/nav/mobile'
import { UserNav } from '@/components/native/nav/user'
import { MainNav } from '@/components/native/nav/desktop'
import { Button } from '@/components/ui/button'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { LogInIcon, ShoppingBasketIcon } from 'lucide-react'
import Link from 'next/link'

export default function Header() {
   const { authenticated } = useAuthenticated()

   return (
      <header className="sticky top-0 z-50 mb-4 w-full border-b border-border/70 bg-background/95 px-4 shadow-sm backdrop-blur-md md:px-16 lg:px-24 xl:px-32 2xl:px-48">
         <div className="flex h-16 items-center">
            <MainNav />
            <MobileNav />
            <div className="flex flex-1 items-center justify-end gap-2">
               <CommandMenu />
               <CartNav />
               {authenticated ? <UserNav /> : <LoginDialog />}
            </div>
         </div>
      </header>
   )
}

export function CartNav() {
   return (
      <Link href="/cart">
         <Button size="tile" variant="brand">
            <ShoppingBasketIcon className="h-4" />
            <span className="sr-only">سبد خرید</span>
         </Button>
      </Link>
   )
}

function LoginDialog() {
   return (
      <Link href="/login">
         <Button size="wide" className="flex">
            <LogInIcon className="h-4" />
            <span>ورود / ثبت‌نام</span>
         </Button>
      </Link>
   )
}
