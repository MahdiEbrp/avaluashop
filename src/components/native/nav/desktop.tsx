'use client'

import {
   NavigationMenu,
   NavigationMenuItem,
   NavigationMenuLink,
   NavigationMenuList,
} from '@/components/ui/navigation-menu'
import config from '@/config/site'
import Link from 'next/link'

export function MainNav() {
   return (
      <div className="hidden items-center gap-8 md:flex">
         <Link href="/" className="shrink-0 text-lg font-bold text-foreground">
            {config.name}
         </Link>
         <NavMenu />
      </div>
   )
}

export function NavMenu() {
   return (
      <NavigationMenu dir="rtl">
         <NavigationMenuList className="gap-1">
            <NavigationMenuItem>
               <NavigationMenuLink asChild variant="trigger">
                  <Link href="/products">همه اکسسوری‌ها</Link>
               </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
               <NavigationMenuLink asChild variant="trigger">
                  <Link href="/about">درباره آوالوا</Link>
               </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
               <NavigationMenuLink asChild variant="trigger">
                  <Link href="/contact">تماس با ما</Link>
               </NavigationMenuLink>
            </NavigationMenuItem>
         </NavigationMenuList>
      </NavigationMenu>
   )
}
