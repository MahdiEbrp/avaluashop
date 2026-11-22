import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
   AvailableToggle as AdminAvailableToggle,
   BrandCombobox as AdminBrandCombobox,
   CategoriesCombobox as AdminCategoriesCombobox,
   SortBy as AdminSortBy,
} from '@/app/admin/(dashboard)/orders/components/options'
import { routerMock } from '../support/navigation'

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      usePathname: () => '/admin/orders',
      useSearchParams: () => new URLSearchParams('sort=featured'),
   }
})

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

beforeEach(() => routerMock.replace.mockClear())

describe('admin order sort filter', () => {
   it('clears the sort when the active value is picked again', async () => {
      render(<AdminSortBy initialData="featured" />)

      await user().click(screen.getByRole('combobox'))
      await user().click((await screen.findAllByText('جدیدترین سفارش')).at(-1)!)

      await waitFor(() =>
         expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders', { scroll: false })
      )
   })

   it('falls back to featured without an initial value', async () => {
      render(<AdminSortBy initialData={undefined} />)

      await user().click(screen.getByRole('combobox'))
      await user().click((await screen.findAllByText('بیشترین مبلغ')).at(-1)!)

      await waitFor(() => expect(routerMock.replace).toHaveBeenCalled())
   })
})

describe('admin order category filter', () => {
   const categories = [
      { id: 'c1', title: 'Shoes' },
      { id: 'c2', title: 'Bags' },
   ]

   it('sets the category param', async () => {
      render(<AdminCategoriesCombobox initialCategory="" categories={categories} />)

      await user().click(screen.getByRole('combobox'))
      await user().click((await screen.findAllByText('Shoes')).at(-1)!)

      expect(routerMock.replace).toHaveBeenCalledWith(
         '/admin/orders?sort=featured&category=Shoes',
         { scroll: false }
      )
   })

   it('removes the category param when re-selected', async () => {
      render(<AdminCategoriesCombobox initialCategory="Shoes" categories={categories} />)

      await user().click(screen.getByRole('combobox'))
      await user().click((await screen.findAllByText('Shoes')).at(-1)!)

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders?sort=featured', {
         scroll: false,
      })
   })

   it('falls back to the placeholder title without a match', () => {
      render(<AdminCategoriesCombobox initialCategory="Nope" categories={categories} />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
   })
})

describe('admin order brand filter', () => {
   const brands = [
      { id: 'b1', title: 'Acme' },
      { id: 'b2', title: 'Globex' },
   ]

   it('sets the brand param', async () => {
      render(<AdminBrandCombobox initialBrand="" brands={brands} />)

      await user().click(screen.getByRole('combobox'))
      await user().click((await screen.findAllByText('Acme')).at(-1)!)

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders?sort=featured&brand=Acme', {
         scroll: false,
      })
   })

   it('removes the brand param when re-selected', async () => {
      render(<AdminBrandCombobox initialBrand="Acme" brands={brands} />)

      await user().click(screen.getByRole('combobox'))
      await user().click((await screen.findAllByText('Acme')).at(-1)!)

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders?sort=featured', {
         scroll: false,
      })
   })

   it('keeps the raw brand when no option matches', () => {
      render(<AdminBrandCombobox initialBrand="Ghost" brands={brands} />)

      expect(screen.getByRole('combobox')).not.toHaveTextContent('Acme')
      expect(screen.getByRole('combobox')).not.toHaveTextContent('Globex')
   })
})

describe('admin order availability filter', () => {
   it('turns the paid filter on', async () => {
      render(<AdminAvailableToggle initialData="false" />)

      await user().click(screen.getByRole('switch'))

      expect(routerMock.replace).toHaveBeenCalledWith(
         '/admin/orders?sort=featured&isAvailable=true',
         { scroll: false }
      )
   })

   it('writes the filter value back as a string', async () => {
      render(<AdminAvailableToggle initialData="true" />)

      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked')

      await user().click(screen.getByRole('switch'))

      expect(routerMock.replace).toHaveBeenCalledWith(
         '/admin/orders?sort=featured&isAvailable=false',
         { scroll: false }
      )
   })
})
