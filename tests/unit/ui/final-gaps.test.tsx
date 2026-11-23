import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BrandForm } from '@/app/admin/(dashboard)/brands/[brandId]/components/brand-form'
import { CategoryForm } from '@/app/admin/(dashboard)/categories/[categoryId]/components/category-form'
import { BannerForm } from '@/app/admin/(dashboard)/banners/[bannerId]/components/banner-form'
import { PaymentForm } from '@/app/admin/(dashboard)/payments/[paymentId]/components/payment-form'
import { ProductForm } from '@/app/admin/(dashboard)/products/[productId]/components/product-form'
import { UserForm as AdminUserForm } from '@/app/admin/(dashboard)/users/[userId]/components/user-form'
import { Item } from '@/app/(store)/(routes)/cart/components/item'
import { DataSection } from '@/app/(store)/(routes)/products/[productId]/components/data'
import { ButtonComponent } from '@/app/(store)/(routes)/products/[productId]/components/cart_button'
import WishlistButton from '@/app/(store)/(routes)/products/[productId]/components/wishlist_button'
import { AddressForm } from '@/app/(store)/(routes)/profile/addresses/[addressId]/components/address-form'
import { UserCombobox } from '@/app/(store)/(routes)/profile/components/switcher'
import { OrderForm as ProfileOrderForm } from '@/app/(store)/(routes)/profile/orders/[orderId]/components/order-form'
import { OrdersTable } from '@/app/(store)/(routes)/profile/orders/components/table'
import { Product } from '@/components/native/Product'
import { LogoutButton } from '@/components/admin/logout-button'
import { UserNav } from '@/components/native/nav/user'
import { Modal } from '@/components/native/modal'
import { widgetState } from '../../stubs/next-cloudinary'
import { routerMock } from '../support/navigation'

const searchParams = new URLSearchParams()
const authState = { authenticated: false }
const cartValue = { cart: undefined as never, dispatchCart: vi.fn(), loading: false }

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      useSearchParams: () => searchParams,
      useParams: () => ({ addressId: 'ad1', orderId: 'o1', productId: 'p1' }),
   }
})

vi.mock('@/hooks/useAuthentication', () => ({
   useAuthenticated: () => ({ authenticated: authState.authenticated }),
}))

vi.mock('@/state/Cart', () => ({
   useCartContext: () => cartValue,
   CartContextProvider: ({ children }: never) => children,
}))

vi.mock('react-hot-toast', () => ({
   toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

const product = {
   id: 'p1',
   title: 'Shoe',
   description: 'Blue',
   price: 100,
   discount: 10,
   images: ['/a.png'],
   isAvailable: true,
   categories: [{ id: 'c1', title: 'Shoes' }],
   brand: { id: 'b1', title: 'Acme' },
}

beforeEach(() => {
   authState.authenticated = false
   cartValue.cart = undefined as never
   cartValue.dispatchCart.mockClear()
   routerMock.push.mockClear()
   for (const key of [...searchParams.keys()]) searchParams.delete(key)
})

describe('guest cart line APIs', () => {
   it('adds a brand-new line through the product endpoint', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(product)))
      vi.stubGlobal('fetch', fetchMock)

      render(<Item cartItem={{ productId: 'p1', product, count: 0 } as never} />)

      await act(async () => {
         fireEvent.click(screen.getByRole('button', { name: /افزودن به سبد خرید/i }))
      })

      await waitFor(() =>
         expect(fetchMock).toHaveBeenCalledWith(
            '/api/product',
            expect.objectContaining({ method: 'POST' })
         )
      )
      expect(cartValue.dispatchCart.mock.calls.at(-1)![0].items[0]).toMatchObject({
         productId: 'p1',
         count: 1,
      })
      vi.unstubAllGlobals()
   })

   it('swallows a failing product lookup', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<Item cartItem={{ productId: 'p1', product, count: 0 } as never} />)
      await act(async () => {
         fireEvent.click(screen.getByRole('button', { name: /افزودن به سبد خرید/i }))
      })

      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })

   it('renders a stored line whose product payload is gone', () => {
      /* A cart persisted before the redesign may carry only the id, so every
         product field falls back gracefully. */
      render(<Item cartItem={{ productId: 'p1', count: 1 } as never} />)

      expect(screen.getAllByAltText('تصویر محصول').length).toBeGreaterThan(0)
      expect(screen.queryByText('Blue')).not.toBeInTheDocument()
   })

   it('removes the last unit from a guest cart', async () => {
      cartValue.cart = { items: [{ productId: 'p1', product, count: 1 }] } as never
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', product, count: 1 }] }))

      render(<Item cartItem={{ productId: 'p1', product, count: 1 } as never} />)

      await act(async () => {
         fireEvent.click(screen.getAllByRole('button')[0])
      })

      expect(cartValue.dispatchCart.mock.calls.at(-1)![0].items).toHaveLength(0)
   })

   it('increments from the quantity controls', async () => {
      cartValue.cart = { items: [{ productId: 'p1', product, count: 1 }] } as never
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', product, count: 1 }] }))

      render(<Item cartItem={{ productId: 'p1', product, count: 1 } as never} />)

      await act(async () => {
         fireEvent.click(screen.getAllByRole('button').at(-1)!)
      })

      expect(cartValue.dispatchCart.mock.calls.at(-1)![0].items[0].count).toBe(2)
   })

   it('falls back to the plain price when there is no discount', () => {
      render(<Item cartItem={{ productId: 'p9', product: { ...product, discount: 0 }, count: 1 } as never} />)

      expect(screen.getByText('۱۰۰ تومان')).toBeInTheDocument()
   })
})

describe('product page cart button', () => {
   it('increments an existing guest line', async () => {
      cartValue.cart = { items: [{ productId: 'p1', count: 1 }] } as never
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', count: 1 }] }))

      render(<ButtonComponent product={product} />)

      /* The count badge is disabled; the trailing + control is the increment. */
      await act(async () => {
         fireEvent.click(screen.getAllByRole('button').at(-1)!)
      })

      expect(cartValue.dispatchCart).toHaveBeenCalled()
   })

   it('decrements from two to one for a guest', async () => {
      cartValue.cart = { items: [{ productId: 'p1', count: 2 }] } as never
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', count: 2 }] }))

      render(<ButtonComponent product={product} />)

      await act(async () => {
         fireEvent.click(screen.getAllByRole('button')[0])
      })

      expect(cartValue.dispatchCart.mock.calls.at(-1)![0].items[0].count).toBe(1)
   })

   it('posts the increment when signed in', async () => {
      authState.authenticated = true
      cartValue.cart = { items: [{ productId: 'p1', count: 1 }] } as never
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ items: [] })))
      vi.stubGlobal('fetch', fetchMock)

      render(<ButtonComponent product={product} />)

      await act(async () => {
         fireEvent.click(screen.getAllByRole('button').at(-1)!)
      })

      await waitFor(() =>
         expect(fetchMock).toHaveBeenCalledWith(
            '/api/cart',
            expect.objectContaining({ body: JSON.stringify({ productId: 'p1', count: 2 }) })
         )
      )
      vi.unstubAllGlobals()
   })

   it('renders a spinner while the request is in flight', async () => {
      authState.authenticated = true
      cartValue.cart = { items: [{ productId: 'p1', count: 1 }] } as never
      let release: (value: Response) => void = () => {}
      const pending = new Promise<Response>((resolve) => {
         release = resolve
      })
      vi.stubGlobal('fetch', vi.fn(() => pending))

      render(<ButtonComponent product={product} />)
      await act(async () => {
         fireEvent.click(screen.getAllByRole('button').at(-1)!)
      })

      expect(screen.getByRole('button')).toBeDisabled()

      await act(async () => {
         release(new Response(JSON.stringify({ items: [] })))
         await pending
      })
      vi.unstubAllGlobals()
   })
})

describe('product data section', () => {
   it('renders the discounted price and title', () => {
      render(<DataSection product={product as never} />)

      /* The redesign renders both the struck-through list price and the
         payable Toman amount; brand chips are gone from the detail card. */
      expect(screen.getByRole('heading', { name: 'Shoe' })).toBeInTheDocument()
      expect(screen.getByText('۱۰۰ تومان')).toBeInTheDocument()
      expect(screen.getByText('۹۰ تومان')).toBeInTheDocument()
   })

   it('marks an unavailable accessory as out of stock', () => {
      render(<DataSection product={{ ...product, isAvailable: false } as never} />)

      /* Sold-out products show the Persian badge instead of a price and drop
         the cart button, but stay wishlist-able. */
      expect(screen.getByText('ناموجود')).toBeInTheDocument()
      expect(screen.queryByText('۹۰ تومان')).not.toBeInTheDocument()
   })

   it('omits the description block when there is no copy', () => {
      render(<DataSection product={{ ...product, description: '' } as never} />)

      expect(screen.getByRole('heading', { name: 'Shoe' })).toBeInTheDocument()
      expect(screen.queryByText('Blue')).not.toBeInTheDocument()
   })

   it('renders a flat price without a discount', () => {
      render(<DataSection product={{ ...product, discount: 0 } as never} />)

      expect(screen.getByText('۱۰۰ تومان')).toBeInTheDocument()
   })
})

describe('wishlist button failures', () => {
   it('logs a failure while saving', async () => {
      authState.authenticated = true
      const fetchMock = vi
         .fn()
         .mockResolvedValueOnce(new Response(JSON.stringify([])))
         .mockRejectedValueOnce(new Error('offline'))
      vi.stubGlobal('fetch', fetchMock)
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<WishlistButton product={product} />)
      /* Wait for the button to settle: the initial wishlist read has landed and
         the spinner is gone before the click, so the click hits the real
         handler rather than the disabled control. */
      await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())

      await act(async () => {
         fireEvent.click(screen.getByRole('button'))
      })

      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })

   it('logs a failure while removing', async () => {
      authState.authenticated = true
      const fetchMock = vi
         .fn()
         .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'p1' }])))
         .mockRejectedValueOnce(new Error('offline'))
      vi.stubGlobal('fetch', fetchMock)
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<WishlistButton product={product} />)
      /* Wait for the button to settle: the initial wishlist read has landed and
         the spinner is gone before the click, so the click hits the real
         handler rather than the disabled control. */
      await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())

      await act(async () => {
         fireEvent.click(screen.getByRole('button'))
      })

      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })
})

describe('admin forms request failures', () => {
   const failFetch = () =>
      vi.fn(async () => new Response(JSON.stringify({ message: 'BOOM' }), { status: 400 }))

   it('banner create failure is reported', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('x'))))
      const { toast } = await import('react-hot-toast')

      render(<BannerForm initialData={null} />)
      widgetStateSuccess()
      await user().type(screen.getByPlaceholderText('Banner label'), 'Sale')
      await user().click(screen.getByRole('button', { name: 'Create' }))

      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      vi.unstubAllGlobals()
   })

   it('brand create failure is reported', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('x'))))
      const { toast } = await import('react-hot-toast')

      render(<BrandForm initialData={null} />)
      await user().type(screen.getByPlaceholderText('Brand title'), 'Acme')
      await user().type(screen.getByPlaceholderText('Brand description'), 'Shoes')
      await user().type(screen.getByPlaceholderText('https://example.com/logo.png'), 'https://x/l.png')
      await user().click(screen.getByRole('button', { name: 'Create' }))

      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      vi.unstubAllGlobals()
   })

   it('category delete failure mentions products', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('x'))))
      const { toast } = await import('react-hot-toast')

      render(
         <CategoryForm
            initialData={{ id: 'c1', title: 'Shoes', description: 'b1' } as never}
         />
      )

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))!
      await user().click(destructive)
      await waitFor(() =>
         expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
      )
      await user().click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() =>
         expect(toast.error).toHaveBeenCalledWith(
            'Make sure you removed all products using this category first.'
         )
      )
      vi.unstubAllGlobals()
   })

   it('product delete failure is reported', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('x'))))
      const { toast } = await import('react-hot-toast')

      render(
         <ProductForm
            categories={[{ id: 'c1', title: 'Shoes' }] as never}
            brands={[] as never}
            initialData={
               {
                  id: 'p1',
                  title: 'Runner',
                  description: 'Fast',
                  price: 20,
                  discount: 0,
                  stock: 3,
                  images: [],
                  categories: [{ id: 'c1', title: 'Shoes' }],
                  categoryId: 'c1',
                  brandId: null,
                  isAvailable: true,
                  isFeatured: false,
               } as never
            }
         />
      )

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))!
      await user().click(destructive)
      await waitFor(() =>
         expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
      )
      await user().click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Something went wrong.'))
      vi.unstubAllGlobals()
   })

   it('admin user form falls back to a generic message', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(async (_url: string, _init?: RequestInit) => new Response('not json', { status: 503 }))
      )
      const { toast } = await import('react-hot-toast')

      render(
         <AdminUserForm
            initialData={{ id: 'u1', name: 'Ada', email: 'a@b.co', phone: '0912', isBanned: false } as never}
         />
      )
      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('503'))
      vi.unstubAllGlobals()
   })

   it('payment form falls back to the generic failure copy', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(async () => new Response(JSON.stringify({}), { status: 400 }))
      )
      const { toast } = await import('react-hot-toast')

      render(
         <PaymentForm
            initialData={
               {
                  id: 'o1',
                  status: 'Processing',
                  shipping: 10,
                  payable: 100,
                  discount: 0,
                  isPaid: false,
                  isCompleted: false,
               } as never
            }
         />
      )
      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('400'))
      vi.unstubAllGlobals()
   })
})

describe('profile order form add path', () => {
   it('creates through the products endpoint when there is no initial data', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}'))
      vi.stubGlobal('fetch', fetchMock)

      render(<ProfileOrderForm initialData={null} />)

      await user().clear(screen.getAllByPlaceholderText('9.99')[0])
      await user().type(screen.getAllByPlaceholderText('9.99')[0], '5')
      await user().clear(screen.getAllByPlaceholderText('9.99')[1])
      await user().type(screen.getAllByPlaceholderText('9.99')[1], '6')
      await user().clear(screen.getAllByPlaceholderText('9.99')[2])
      await user().type(screen.getAllByPlaceholderText('9.99')[2], '0')

      await user().click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      expect(fetchMock.mock.calls[0][0]).toBe('/api/products')
      vi.unstubAllGlobals()
   })
})

describe('address form create failure', () => {
   it('reports a failed create', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('x'))))
      const { toast } = await import('react-hot-toast')

      render(<AddressForm initialData={null} />)

      await user().type(screen.getByPlaceholderText('Tehran'), 'Shiraz')
      await user().type(screen.getByPlaceholderText('09123456789'), '09120000000')
      await user().type(screen.getByPlaceholderText('1234567890'), '1234567890')
      await user().type(screen.getByPlaceholderText('Street - Building Number'), 'Main St')
      await user().click(screen.getByRole('button', { name: 'Create' }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Something went wrong.'))
      vi.unstubAllGlobals()
   })
})

describe('profile switcher', () => {
   it('labels the current section from the pathname', () => {
      render(<UserCombobox initialValue="/profile/addresses" />)

      expect(screen.getAllByRole('button')[0]).toHaveTextContent('Addresses')
   })

   it('lists every destination', async () => {
      render(<UserCombobox initialValue="/profile/edit" />)

      await user().click(screen.getAllByRole('button')[0])

      expect((await screen.findAllByText('Addresses')).length).toBeGreaterThan(0)
      expect(screen.getAllByText('Orders').length).toBeGreaterThan(0)
   })
})

describe('orders table', () => {
   it('renders a paid and an unpaid order differently', () => {
      const { container } = render(
         <OrdersTable
            data={[
               { id: 'o1', number: 'Order #1', createdAt: '2024', payable: '$5', isPaid: true },
               { id: 'o2', number: 'Order #2', createdAt: '2024', payable: '$6', isPaid: false },
            ]}
         />
      )

      expect(container.querySelectorAll('svg').length).toBeGreaterThan(1)
   })
})

describe('product card', () => {
   it('shows the discounted price block', () => {
      render(<Product product={product as never} />)

      expect(screen.getAllByText('Shoe').length).toBeGreaterThan(0)
      /* Price is Toman-formatted and the badge speaks Persian. */
      expect(screen.getByText('٪۱۰ تخفیف')).toBeInTheDocument()
      expect(screen.getByText('۱۰۰ تومان')).toBeInTheDocument()
      expect(screen.getByText('۹۰ تومان')).toBeInTheDocument()
   })

   it('shows the flat price block', () => {
      render(<Product product={{ ...product, discount: 0 } as never} />)

      expect(screen.getByText('۱۰۰ تومان')).toBeInTheDocument()
      expect(screen.queryByText(/تخفیف/)).toBeNull()
   })
})

describe('native modal', () => {
   it('closes when the dialog reports closed', async () => {
      const onClose = vi.fn()

      render(
         <Modal title="Hi" description="There" isOpen onClose={onClose}>
            <p>body</p>
         </Modal>
      )

      await user().keyboard('{Escape}')

      expect(onClose).toHaveBeenCalled()
   })

   it('renders nothing visible when closed', () => {
      render(<Modal title="Hi" description="There" isOpen={false} onClose={vi.fn()} />)

      expect(screen.queryByText('There')).not.toBeInTheDocument()
   })
})

describe('logout failure paths', () => {
   it('admin logout logs a network failure', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('x'))))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<LogoutButton />)
      await user().click(screen.getByRole('button'))

      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })

   it('storefront logout does not reload on a non-200 answer', async () => {
      vi.stubGlobal('fetch', vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 500 })))
      const reload = vi.fn()
      vi.stubGlobal('location', { ...globalThis.location, reload })

      render(<UserNav />)
      await user().click(screen.getByRole('button'))
      await user().click(await screen.findByText(/خروج از حساب/i))

      await waitFor(() =>
         expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', { cache: 'no-store' })
      )
      expect(reload).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
   })
})

function widgetStateSuccess() {
   widgetState.onSuccess?.({ info: { secure_url: 'https://cdn/x.png' } })
}
