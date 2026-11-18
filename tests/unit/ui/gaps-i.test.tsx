import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
   AvailableToggle as AdminAvailableToggle,
   BrandCombobox as AdminBrandCombobox,
   CategoriesCombobox as AdminCategoriesCombobox,
} from '@/app/admin/(dashboard)/orders/components/options'
import { routerMock } from '../support/navigation'

/* An empty query string is the one case where the controls build a bare
   pathname: every param they own has just been deleted. */
vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      usePathname: () => '/admin/orders',
      useSearchParams: () => new URLSearchParams(),
   }
})

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

beforeEach(() => routerMock.replace.mockClear())

describe('admin order filters with no query string', () => {
   it('drops the category param and leaves a bare path', async () => {
      render(<AdminCategoriesCombobox initialCategory="Shoes" categories={[{ id: 'c1', title: 'Shoes' }]} />)

      await user().click(screen.getByRole('combobox'))
      await user().click((await screen.findAllByText('Shoes')).at(-1)!)

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders', { scroll: false })
   })

   it('drops the brand param and leaves a bare path', async () => {
      render(<AdminBrandCombobox initialBrand="Acme" brands={[{ id: 'b1', title: 'Acme' }]} />)

      await user().click(screen.getByRole('combobox'))
      await user().click((await screen.findAllByText('Acme')).at(-1)!)

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders', { scroll: false })
   })

   it('adds the availability flag as the only param', async () => {
      render(<AdminAvailableToggle initialData="false" />)

      await user().click(screen.getByRole('switch'))

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders?isAvailable=true', {
         scroll: false,
      })
   })
})
