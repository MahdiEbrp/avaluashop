import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DataTable } from '@/components/ui/data-table'
import { DataTable as AdminDataTable } from '@/components/admin/ui/data-table'
import Header from '@/components/native/nav/parent'

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return { ...actual, ...navigation, usePathname: () => '/' }
})

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

/* The luxury redesign ships a fixed light palette and drops the storefront
   theme toggle, so there is no longer a control here to exercise. The admin
   toggle keeps its own coverage. */

describe('tables with a placeholder header', () => {
   const columns = [
      {
         id: 'placeholder',
         header: () => null,
         cell: () => <span>cell</span>,
      },
   ]

   it('renders a null header without breaking the row', () => {
      render(<DataTable columns={columns as never} data={[{ name: 'alpha' }]} searchKey="name" />)

      expect(screen.getByText('cell')).toBeInTheDocument()
   })

   it('does the same in the admin table', () => {
      render(<AdminDataTable columns={columns as never} data={[{ name: 'alpha' }]} searchKey="name" />)

      expect(screen.getByText('cell')).toBeInTheDocument()
   })
})

describe('tables without a header at all', () => {
   const columns = [
      { id: 'bare', cell: () => <span>bare cell</span> },
   ]

   it('reads the header through the placeholder path', () => {
      render(<DataTable columns={columns as never} data={[{ name: 'a' }]} searchKey="name" />)

      expect(screen.getByText('bare cell')).toBeInTheDocument()
   })
})

/* A grouped column makes TanStack emit a second header row whose cells are
   placeholders; that is the only way `header.isPlaceholder` is ever true. */
describe('tables with grouped columns', () => {
   const columns = [
      {
         id: 'group',
         header: 'Group',
         columns: [
            { id: 'a', header: 'A', cell: () => <span>ca</span> },
            { id: 'b', header: 'B', cell: () => <span>cb</span> },
         ],
      },
      { id: 'c', header: 'C', cell: () => <span>cc</span> },
   ]

   it('skips the placeholder cell in the storefront table', () => {
      const { container } = render(
         <DataTable columns={columns as never} data={[{ a: 1, b: 2, c: 3 }]} searchKey="a" />
      )

      expect(screen.getByText('Group')).toBeInTheDocument()
      expect(screen.getByText('ca')).toBeInTheDocument()
      expect(
         [...container.querySelectorAll('th')].some((cell) => cell.textContent === '')
      ).toBe(true)
   })

   it('skips the placeholder cell in the admin table', () => {
      const { container } = render(
         <AdminDataTable columns={columns as never} data={[{ a: 1, b: 2, c: 3 }]} searchKey="a" />
      )

      expect(screen.getByText('Group')).toBeInTheDocument()
      expect(
         [...container.querySelectorAll('th')].some((cell) => cell.textContent === '')
      ).toBe(true)
   })
})

describe('tables with no rows', () => {
   const columns = [{ id: 'name', header: 'Name', cell: () => null }]

   it('renders the empty-state row in the storefront table', () => {
      render(<DataTable columns={columns as never} data={[]} searchKey="name" />)

      expect(screen.getByText('No results.')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search')).toBeInTheDocument()
   })

   it('renders the empty-state row in the admin table', () => {
      render(<AdminDataTable columns={columns as never} data={[]} searchKey="name" />)

      expect(screen.getByText('No results.')).toBeInTheDocument()
   })
})

describe('admin main nav on an active route', () => {
   it('marks the matching section semibold', async () => {
      vi.resetModules()
      vi.doMock('next/navigation', async (importOriginal) => {
         const actual = await importOriginal<typeof import('next/navigation')>()
         const navigation = await import('../support/navigation')

         return { ...actual, ...navigation, usePathname: () => '/admin/orders' }
      })

      const { MainNav } = await import('@/components/admin/main-nav')
      render(<MainNav />)

      expect(screen.getByRole('link', { name: 'Orders' }).className).toContain('font-semibold')
      vi.doUnmock('next/navigation')
      vi.resetModules()
   })
})
