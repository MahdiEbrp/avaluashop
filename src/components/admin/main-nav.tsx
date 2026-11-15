'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function MainNav({
   className,
   ...props
}: Readonly<React.HTMLAttributes<HTMLElement>>) {
   const pathname = usePathname()

   const routes = [
      {
         href: `/admin/banners`,
         label: 'Banners',
         active: pathname.includes(`/admin/banners`),
      },
      {
         href: `/admin/categories`,
         label: 'Categories',
         active: pathname.includes(`/admin/categories`),
      },
      {
         href: `/admin/products`,
         label: 'Products',
         active: pathname.includes(`/admin/products`),
      },
      {
         href: `/admin/orders`,
         label: 'Orders',
         active: pathname.includes(`/admin/orders`),
      },
      {
         href: `/admin/payments`,
         label: 'Payments',
         active: pathname.includes(`/admin/payments`),
      },
      {
         href: `/admin/users`,
         label: 'Users',
         active: pathname.includes(`/admin/users`),
      },
      {
         href: `/admin/brands`,
         label: 'Brands',
         active: pathname.includes(`/admin/brands`),
      },
      {
         href: `/codes`,
         label: 'Codes',
         active: pathname.includes(`/codes`),
      },
   ]

   return (
      <nav
         className={cn('flex items-center space-x-4 lg:space-x-6', className)}
         {...props}
      >
         {routes.map((route) => (
            <Link
               key={route.href}
               href={route.href}
               className={cn(
                  'text-sm transition-colors hover:text-primary',
                  route.active
                     ? 'font-semibold'
                     : 'font-light text-muted-foreground'
               )}
            >
               {route.label}
            </Link>
         ))}
      </nav>
   )
}
