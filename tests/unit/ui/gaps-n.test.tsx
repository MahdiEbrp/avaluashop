import { render, screen } from '@testing-library/react'

import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
   DropdownMenu as AdminDropdownMenu,
   DropdownMenuContent as AdminDropdownMenuContent,
   DropdownMenuItem as AdminDropdownMenuItem,
   DropdownMenuLabel as AdminDropdownMenuLabel,
   DropdownMenuTrigger as AdminDropdownMenuTrigger,
} from '@/components/admin/ui/dropdown-menu'
import Carousel from '@/components/native/Carousel'

/* `inset` is a styling hint no page in this app happens to use yet; without it
   those two class branches stay dark even though the components ship. */
describe('inset dropdown items', () => {
   it('indents a storefront item and label', () => {
      render(
         <DropdownMenu open>
            <DropdownMenuTrigger>open</DropdownMenuTrigger>
            <DropdownMenuContent>
               <DropdownMenuLabel inset>Section</DropdownMenuLabel>
               <DropdownMenuItem inset>Indented</DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      )

      expect(screen.getByText('Indented')).toHaveClass('pl-8')
      expect(screen.getByText('Section')).toHaveClass('pl-8')
   })

   it('indents an admin item and label', () => {
      render(
         <AdminDropdownMenu open>
            <AdminDropdownMenuTrigger>open</AdminDropdownMenuTrigger>
            <AdminDropdownMenuContent>
               <AdminDropdownMenuLabel inset>Section</AdminDropdownMenuLabel>
               <AdminDropdownMenuItem inset>Indented</AdminDropdownMenuItem>
            </AdminDropdownMenuContent>
         </AdminDropdownMenu>
      )

      expect(screen.getByText('Indented')).toHaveClass('pl-8')
      expect(screen.getByText('Section')).toHaveClass('pl-8')
   })
})

describe('carousel with no slides', () => {
   it('treats a missing selected index as the first slide', () => {
      /* embla never reports a snap without slides, so `index || 0` collapses to
         the first dot; the assertion is that the render does not throw. */
      const { container } = render(<Carousel images={[]} />)

      expect(container.querySelectorAll('.rounded-full')).toHaveLength(0)
   })
})

describe('prisma client in a production build', () => {
   it('does not cache itself on the global object', async () => {
      vi.resetModules()
      vi.stubEnv('NODE_ENV', 'production')

      const before = (globalThis as { prisma?: unknown }).prisma

      const { default: prisma } = await import('@/lib/prisma')

      expect(prisma).toBeDefined()
      expect((globalThis as { prisma?: unknown }).prisma).toBe(before)
      vi.unstubAllEnvs()
      vi.resetModules()
   })
})

