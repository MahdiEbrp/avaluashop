import { MainNav } from '@/components/admin/main-nav'
import { ThemeToggle } from '@/components/admin/theme-toggle'
import Link from 'next/link'

import { LogoutButton } from './logout-button'

export default function Navbar() {
   return (
      <div className="border-b flex justify-between h-16 items-center px-5.5 md:px-16 lg:px-24 xl:px-32 2xl:px-48">
         <div className="flex gap-6">
            <Link href="/" className="font-bold tracking-wider">
               ADMIN
            </Link>
            <MainNav />
         </div>
         <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
         </div>
      </div>
   )
}
