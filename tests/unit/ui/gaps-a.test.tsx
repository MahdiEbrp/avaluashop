import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BrandCombobox, CategoriesCombobox, SortBy as AdminSortBy, AvailableToggle as AdminAvailableToggle } from '@/app/admin/(dashboard)/orders/components/options'
import { Item } from '@/app/(store)/(routes)/cart/components/item'
import { ButtonComponent } from '@/app/(store)/(routes)/products/[productId]/components/cart_button'
import { ProductForm } from '@/app/admin/(dashboard)/products/[productId]/components/product-form'
import { UserAuthForm } from '@/app/admin/login/components/user-auth-form'
import AdminImageUpload from '@/components/admin/ui/image-upload'
import StoreImageUpload from '@/components/native/image-upload'
import { widgetState } from '../../stubs/next-cloudinary'
import { routerMock } from '../support/navigation'

const searchParams = new URLSearchParams()
const authState = { authenticated: false }
const cartValue = { cart: undefined as never, dispatchCart: vi.fn() }

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      useSearchParams: () => searchParams,
      usePathname: () => '/admin/orders',
      useParams: () => ({ productId: 'p1' }),
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
   routerMock.replace.mockClear()
   for (const key of [...searchParams.keys()]) searchParams.delete(key)
})

describe('authenticated cart mutations', () => {
   it('posts the increment for a signed-in cart line', async () => {
      authState.authenticated = true
      cartValue.cart = { items: [{ productId: 'p1', product, count: 1 }] } as never
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] })))
      vi.stubGlobal('fetch', fetchMock)

      render(<Item cartItem={{ productId: 'p1', product, count: 1 } as never} />)

      await act(async () => {
         fireEvent.click(screen.getAllByRole('button').at(-1)!)
      })

      await waitFor(() =>
         expect(fetchMock).toHaveBeenCalledWith(
            '/api/cart',
            expect.objectContaining({
               body: JSON.stringify({ productId: 'p1', count: 2 }),
            })
         )
      )
      expect(cartValue.dispatchCart).toHaveBeenCalled()
      vi.unstubAllGlobals()
   })

   it('posts the decrement for a signed-in cart line', async () => {
      authState.authenticated = true
      cartValue.cart = { items: [{ productId: 'p1', product, count: 2 }] } as never
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] })))
      vi.stubGlobal('fetch', fetchMock)

      render(<Item cartItem={{ productId: 'p1', product, count: 2 } as never} />)

      await act(async () => {
         fireEvent.click(screen.getAllByRole('button')[0])
      })

      await waitFor(() =>
         expect(fetchMock).toHaveBeenCalledWith(
            '/api/cart',
            expect.objectContaining({
               body: JSON.stringify({ productId: 'p1', count: 1 }),
            })
         )
      )
      vi.unstubAllGlobals()
   })

   it('logs a failed authenticated add', async () => {
      authState.authenticated = true
      cartValue.cart = { items: [] } as never
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<Item cartItem={{ productId: 'p1', product, count: 0 } as never} />)
      await act(async () => {
         fireEvent.click(screen.getByRole('button', { name: /add to cart/i }))
      })

      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })
})

describe('cart button authenticated remove', () => {
   it('posts the decrement when the visitor is signed in', async () => {
      authState.authenticated = true
      cartValue.cart = { items: [{ productId: 'p1', count: 1 }] } as never
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] })))
      vi.stubGlobal('fetch', fetchMock)

      render(<ButtonComponent product={product} />)

      await act(async () => {
         fireEvent.click(screen.getAllByRole('button')[0])
      })

      await waitFor(() =>
         expect(fetchMock).toHaveBeenCalledWith(
            '/api/cart',
            expect.objectContaining({ body: JSON.stringify({ productId: 'p1', count: 0 }) })
         )
      )
      vi.unstubAllGlobals()
   })

   it('removes the only guest unit through the X control', async () => {
      cartValue.cart = { items: [{ productId: 'p1', count: 1 }] } as never
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', count: 1 }] }))

      render(<ButtonComponent product={product} />)

      await act(async () => {
         fireEvent.click(screen.getAllByRole('button')[0])
      })

      expect(cartValue.dispatchCart.mock.calls.at(-1)![0].items).toHaveLength(0)
   })
})

describe('admin order filter chrome', () => {
   it('applies a sort choice', async () => {
      render(<AdminSortBy initialData="highest_payable" />)

      await user().click(screen.getByRole('combobox'))
      await user().click(await screen.findByText('Least Expensive'))

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders?sort=least_expensive', {
         scroll: false,
      })
   })

   it('sets the sort choice with the shared control', async () => {
      render(<AdminSortBy initialData="featured" />)

      await user().click(screen.getByRole('combobox'))
      await user().click(screen.getAllByText('Featured').at(-1)!)

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders', { scroll: false })
   })

   it('narrows the order list by category', async () => {
      render(
         <CategoriesCombobox
            initialCategory=""
            categories={[{ id: 'c1', title: 'Shoes' }]}
         />
      )

      await user().click(screen.getByRole('combobox'))
      await user().click(await screen.findByText('Shoes'))

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders?category=Shoes', {
         scroll: false,
      })
   })

   it('narrows the order list by brand', async () => {
      render(<BrandCombobox initialBrand="" brands={[{ id: 'b1', title: 'Acme' }]} />)

      await user().click(screen.getByRole('combobox'))
      await user().click(await screen.findByText('Acme'))

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders?brand=Acme', {
         scroll: false,
      })
   })

   it('filters to paid orders only', async () => {
      render(<AdminAvailableToggle initialData="false" />)

      await user().click(screen.getByRole('switch'))

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders?isAvailable=true', {
         scroll: false,
      })
   })
})

describe('product form image field', () => {
   const categories = [{ id: 'c1', title: 'Shoes' }]

   it('appends an uploaded image and removes it', async () => {
      render(<ProductForm categories={categories as never} initialData={null} />)

      act(() => {
         widgetState.onSuccess?.({ info: { secure_url: 'https://cdn/new.png' } })
      })

      const remove = await screen.findByRole('button', { name: '' })
      fireEvent.click(remove)

      expect(screen.getByText('Create product')).toBeInTheDocument()
   })

   it('toggles the featured and available switches', async () => {
      render(<ProductForm categories={categories as never} initialData={null} />)

      const switches = screen.getAllByRole('checkbox')
      await user().click(switches[0])
      await user().click(switches[1])

      expect(switches[0]).toHaveAttribute('data-state', 'checked')
   })
})

describe('admin login form phone flow', () => {
   it('requests an OTP by phone and verifies it', async () => {
      searchParams.set('method', 'phone')
      searchParams.set('phone', '09123456789')
      const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const assign = vi.fn()
      vi.stubGlobal('location', { ...globalThis.location, assign, origin: 'http://localhost' })

      render(<UserAuthForm />)

      await user().click(screen.getByRole('button', { name: /login with phone/i }))
      await waitFor(() => expect(screen.getByText('One-Time Password')).toBeInTheDocument())
      expect(fetchMock).toHaveBeenCalledWith(
         '/api/admin/auth/otp/phone/try',
         expect.objectContaining({ method: 'POST' })
      )

      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() =>
         expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/admin/auth/otp/phone/verify',
            expect.objectContaining({ method: 'POST' })
         )
      )
      await waitFor(() => expect(assign).toHaveBeenCalledWith('http://localhost/admin'))
      vi.unstubAllGlobals()
   })

   it('switches the admin method back and forth', async () => {
      searchParams.set('method', 'phone')
      render(<UserAuthForm />)

      await user().click(screen.getByRole('button', { name: 'Email' }))

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/orders?method=email', {
         scroll: false,
      })
   })
})

describe('image upload chrome', () => {
   it('disables the admin upload button while saving', () => {
      render(<AdminImageUpload disabled value={[]} onChange={vi.fn()} onRemove={vi.fn()} />)

      expect(screen.getByRole('button', { name: /upload an image/i })).toBeDisabled()
   })

   it('removes a storefront image', () => {
      const onRemove = vi.fn()

      render(<StoreImageUpload value={['https://cdn/a.png']} onChange={vi.fn()} onRemove={onRemove} />)

      fireEvent.click(screen.getAllByRole('button')[0])

      expect(onRemove).toHaveBeenCalledWith('https://cdn/a.png')
   })
})
