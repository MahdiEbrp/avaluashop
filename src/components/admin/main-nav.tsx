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
      { href: '/admin/banners', label: 'Banners' },
      { href: '/admin/categories', label: 'Categories' },
      { href: '/admin/products', label: 'Products' },
      { href: '/admin/orders', label: 'Orders' },
      { href: '/admin/payments', label: 'Payments' },
      { href: '/admin/settings', label: 'Settings' },
      { href: '/admin/shipping', label: 'Shipping' },
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/brands', label: 'Brands' },
      { href: '/codes', label: 'Codes' },
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
                  pathname.startsWith(route.href)
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
