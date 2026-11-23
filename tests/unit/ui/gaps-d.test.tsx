import { stubLocation } from '../support/location'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Item } from '@/app/(store)/(routes)/cart/components/item'
import { ButtonComponent } from '@/app/(store)/(routes)/products/[productId]/components/cart_button'
import { UserForm } from '@/app/(store)/(routes)/profile/edit/components/user-form'
import { OrderForm as ProfileOrderForm } from '@/app/(store)/(routes)/profile/orders/[orderId]/components/order-form'
import { CategoryForm } from '@/app/admin/(dashboard)/categories/[categoryId]/components/category-form'
import { OrderTable } from '@/app/admin/(dashboard)/orders/components/table'
import { ProductsTable } from '@/app/admin/(dashboard)/products/components/table'
import { columns as paymentColumns } from '@/app/admin/(dashboard)/payments/components/columns'
import AdminError from '@/app/admin/(dashboard)/error'
import { LogoutButton } from '@/components/admin/logout-button'
import { MainNav } from '@/components/admin/main-nav'
import { Modal } from '@/components/admin/ui/modal'
import { AlertModal as StoreAlertModal } from '@/components/modals/alert-modal'
import { Separator as AdminSeparator } from '@/components/admin/ui/separator'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { CartContextProvider } from '@/state/Cart'
import Carousel from '@/components/native/Carousel'
import { prismaMock } from '../support/db'
import { routerMock } from '../support/navigation'
import { setCookie } from '../support/cookies'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))
vi.mock('next/cache', () => import('../support/cache'))
vi.mock('react-hot-toast', () => ({
   toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      useParams: () => ({ productId: 'p1', categoryId: 'c1' }),
      usePathname: () => '/admin',
      useSearchParams: () => new URLSearchParams(),
   }
})

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

const signIn = () => {
   setCookie('logged-in=true')
}
const signOut = () => {
   setCookie('logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT')
}

beforeEach(() => {
   signOut()
   routerMock.push.mockClear()
   routerMock.refresh.mockClear()
})

afterEach(() => {
   signOut()
   vi.unstubAllGlobals()
})

describe('profile edit form', () => {
   it('creates the profile through /api/products', async () => {
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)

      render(<UserForm initialData={null} />)

      await user().clear(screen.getByPlaceholderText('Full Name'))
      await user().type(screen.getByPlaceholderText('Full Name'), 'Ada')
      await user().click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })
      expect(fetchMock.mock.calls[0][0]).toBe('/api/products')
      expect(routerMock.refresh).toHaveBeenCalled()
   })

   it('patches the profile when there is existing data', async () => {
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)

      render(
         <UserForm
            initialData={{ id: 'u1', name: 'Ada', phone: '0912', email: 'a@b.co' } as never}
         />
      )

      await user().click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })
      expect(fetchMock.mock.calls[0][0]).toBe('/api/products/p1')
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PATCH' })
   })

   it('reports a rejected request', async () => {
      const { toast } = await import('react-hot-toast')
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('offline')); }))

      render(<UserForm initialData={null} />)

      await user().type(screen.getByPlaceholderText('Full Name'), 'Ada')
      await user().click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Something went wrong.'); })
   })
})

describe('profile order form', () => {
   it('reports a failed cancellation', async () => {
      const { toast } = await import('react-hot-toast')
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('offline')); }))

      render(
         <ProfileOrderForm
            initialData={
               {
                  id: 'o1',
                  status: 'Pending',
                  shipping: 10,
                  payable: 100,
                  discount: 0,
                  isPaid: false,
                  isCompleted: false,
               } as never
            }
         />
      )

      await user().click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Something went wrong.'); })
   })
})

describe('category form failure', () => {
   it('reports a rejected save', async () => {
      const { toast } = await import('react-hot-toast')
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('offline')); }))

      render(
         <CategoryForm
            initialData={null}
         />
      )

      await user().type(screen.getByPlaceholderText('Category name'), 'Shoes')
      await user().type(screen.getByPlaceholderText('Category description'), 'Shoes')
      await user().click(screen.getByRole('button', { name: /create/i }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Something went wrong.'); })
   })
})

describe('admin table status cells', () => {
   it('renders both paid and unpaid order marks', () => {
      const base = {
         id: 'o1',
         payable: 100,
         user: { id: 'u1', name: 'Ada' },
         createdAt: new Date(),
         updatedAt: new Date(),
      }

      render(
         <OrderTable
            data={
               [
                  { ...base, isPaid: true },
                  { ...base, id: 'o2', isPaid: false },
               ] as never
            }
         />
      )

      expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
   })

   it('renders available and unavailable product marks', () => {
      const base = {
         id: 'p1',
         title: 'Shoe',
         price: 100,
         discount: 0,
         category: 'Shoes',
         brand: 'Acme',
      }

      render(
         <ProductsTable
            data={
               [
                  { ...base, isAvailable: true },
                  { ...base, id: 'p2', isAvailable: false },
               ] as never
            }
         />
      )

      expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
   })

   it('renders successful and failed payment marks', () => {
      const Cell = paymentColumns.find(
         (column) => (column as { accessorKey?: string }).accessorKey === 'isSuccessful'
      ) as never

      render(
         <table>
            <thead><tr><th>Status</th></tr></thead>
            <tbody>
               <tr>
                  <td>
                     {(Cell as { cell: (p: unknown) => unknown }).cell({
                        cell: { getValue: () => false },
                     }) as never}
                  </td>
               </tr>
            </tbody>
         </table>
      )

      expect(screen.getByRole('table')).toBeInTheDocument()
   })
})

describe('admin chrome', () => {
   it('marks a nav item active for a nested path', () => {
      render(<MainNav />)

      /* Pathname is /admin, which matches the dashboard route. */
      expect(screen.getAllByRole('link').length).toBeGreaterThan(0)
   })

   it('shows the error digest', () => {
      render(<AdminError error={{ digest: 'abc123' } as never} reset={vi.fn()} />)

      expect(screen.getByText('abc123')).toBeInTheDocument()
   })

   it('falls back to n/a without a digest', () => {
      render(<AdminError error={{} as never} reset={vi.fn()} />)

      expect(screen.getByText('n/a')).toBeInTheDocument()
   })

   it('reloads the page after logging out', async () => {
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)
      const reload = vi.fn()
      stubLocation({ reload, origin: 'http://localhost' })

      render(<LogoutButton />)
      await user().click(screen.getByRole('button'))

      await waitFor(() => { expect(reload).toHaveBeenCalled(); })
   })

   it('logs a failed logout request', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('offline')); }))

      render(<LogoutButton />)
      await user().click(screen.getByRole('button'))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      errorSpy.mockRestore()
   })
})

describe('modals and separators', () => {
   it('renders the admin modal only when open', () => {
      const { rerender } = render(
         <Modal title="Delete?" description="Gone for good." isOpen={false} onClose={vi.fn()} />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      rerender(
         <Modal title="Delete?" description="Gone for good." isOpen onClose={vi.fn()}>
            <p>modal child</p>
         </Modal>
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('modal child')).toBeInTheDocument()
   })

   it('renders the storefront alert modal only when open', () => {
      const { rerender } = render(
         <StoreAlertModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} loading={false} />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      rerender(<StoreAlertModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} loading={false} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
   })

   it('renders a vertical separator', () => {
      const { container } = render(<AdminSeparator orientation="vertical" />)

      expect(container.firstChild).toHaveAttribute('data-orientation', 'vertical')
   })

   it('renders a horizontal scroll area with its bar', () => {
      render(
         <ScrollArea>
            <p>wide content</p>
            <ScrollBar orientation="horizontal" />
         </ScrollArea>
      )

      expect(screen.getByText('wide content')).toBeInTheDocument()
   })
})

describe('carousel without images', () => {
   it('renders without dots', () => {
      const { container } = render(<Carousel images={[]} />)

      expect(container.querySelectorAll('button').length).toBe(0)
   })

   it('renders one dot per image', () => {
      const { container } = render(<Carousel images={['/a.png', '/b.png']} />)

      expect(container.querySelectorAll('.rounded-full').length).toBe(2)
   })
})

describe('cart item storage failures', () => {
   it('logs when localStorage refuses the write', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })
      const setItem = vi
         .spyOn(Storage.prototype, 'setItem')
         .mockImplementation(() => {
            throw new Error('quota exceeded')
         })

      const product = {
         id: 'p1',
         title: 'Shoe',
         description: 'Blue',
         price: 100,
         discount: 0,
         images: ['/a.png'],
      }

      render(<Item cartItem={{ productId: 'p1', product, count: 1 }} />)

      await user().click(screen.getAllByRole('button').at(-1))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      setItem.mockRestore()
      errorSpy.mockRestore()
   })
})

describe('product cart button failures', () => {
   it('logs a failed guest adjustment', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', count: 1 }] }))
      /* Both reads and writes fail, so the guest path cannot recover. */
      const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
         throw new Error('storage disabled')
      })
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
         throw new Error('quota exceeded')
      })

      render(
         <ButtonComponent
            product={
               {
                  id: 'p1',
                  title: 'Shoe',
                  description: 'Blue',
                  price: 100,
                  discount: 0,
                  images: ['/a.png'],
               }
            }
         />
      )

      await user().click(screen.getAllByRole('button').at(-1))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      getItem.mockRestore()
      setItem.mockRestore()
      errorSpy.mockRestore()
   })
})

describe('product listing search params', () => {
   it('reads every filter from an undefined object', async () => {
      prismaMock.brand.findMany.mockResolvedValue([])
      prismaMock.category.findMany.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])

      const { default: Products } = await import('@/app/(store)/(routes)/products/page')

      const element = await Products({ searchParams: undefined })
      render(element)

      expect(prismaMock.product.findMany).toHaveBeenCalled()
   })

   it('reads every filter when no search params were provided', async () => {
      prismaMock.brand.findMany.mockResolvedValue([])
      prismaMock.category.findMany.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])

      const { default: Products } = await import('@/app/(store)/(routes)/products/page')

      const element = await Products({ searchParams: Promise.resolve(null) })
      render(element)

      expect(prismaMock.product.findMany).toHaveBeenCalled()
   })
})

describe('admin orders page search params', () => {
   it('lists orders without any filters', async () => {
      prismaMock.order.findMany.mockResolvedValue([])
      prismaMock.user.findMany.mockResolvedValue([])

      const { default: OrdersPage } = await import('@/app/admin/(dashboard)/orders/page')

      render(await OrdersPage({ searchParams: {} } as never))

      expect(prismaMock.order.findMany).toHaveBeenCalled()
   })
})

describe('profile pages without a session', () => {
   it('never calls the API for a signed-out visitor', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const { default: AddressesPage } = await import(
         '@/app/(store)/(routes)/profile/addresses/page'
      )
      render(<AddressesPage />)

      expect(fetchMock).not.toHaveBeenCalled()
   })

   it('renders the edit page loader while signed out', async () => {
      const { default: EditPage } = await import('@/app/(store)/(routes)/profile/edit/page')

      render(<EditPage />)

      expect(document.querySelector('svg')).toBeInTheDocument()
   })

   it('addresses page renders a table once the list arrives', async () => {
      signIn()
      vi.stubGlobal(
         'fetch',
         vi.fn(
            () =>
               Promise.resolve(Response.json(
                  [
                     { id: 'a1', city: 'T', address: 'A', phone: '1', postalCode: '2' },
                  ]
               ))
         )
      )

      const { default: AddressesPage } = await import(
         '@/app/(store)/(routes)/profile/addresses/page'
      )
      render(<AddressesPage />)

      expect(await screen.findByRole('table')).toBeInTheDocument()
   })
})

describe('admin order page with a session', () => {
   it('renders orders for the signed-in user', async () => {
      prismaMock.order.findMany.mockResolvedValue([
         {
            id: 'o1',
            payable: 100,
            isPaid: true,
            user: { id: 'u1', name: 'Ada' },
            createdAt: new Date(),
            updatedAt: new Date(),
         },
      ])
      prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Ada' }])

      const { default: OrdersPage } = await import('@/app/admin/(dashboard)/orders/page')
      render(
         await OrdersPage({
            searchParams: {
               sort: 'highest_payable',
               isPaid: 'true',
               brand: 'Acme',
               category: 'Shoes',
               page: '2',
               minPayable: '10',
               maxPayable: '1000',
            },
         } as never)
      )

      expect(prismaMock.order.findMany.mock.calls[0][0].skip).toBe(12)
   })
})

describe('cart controls with a nonsensical negative count', () => {
   const product = {
      id: 'p1',
      title: 'Shoe',
      description: 'Blue',
      price: 100,
      discount: 0,
      images: ['/a.png'],
   }

   /* A corrupt local cart can hold a negative count; neither the "add" nor the
      "quantity" branch matches, so the controls render nothing at all. */
   it('renders nothing for a negative line count in the cart page', () => {
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', count: -2 }] }))

      render(
         <CartContextProvider>
            <Item cartItem={{ productId: 'p1', product, count: -2 }} />
         </CartContextProvider>
      )

      expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument()
   })

   it('renders nothing for a negative line count on the product page', () => {
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', count: -2 }] }))

      render(
         <CartContextProvider>
            <ButtonComponent product={product as never} />
         </CartContextProvider>
      )

      expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument()
   })
})
