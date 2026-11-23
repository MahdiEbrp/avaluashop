import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BannerForm } from '@/app/admin/(dashboard)/banners/[bannerId]/components/banner-form'
import { BrandForm } from '@/app/admin/(dashboard)/brands/[brandId]/components/brand-form'
import { CategoryForm } from '@/app/admin/(dashboard)/categories/[categoryId]/components/category-form'
import { ProductForm } from '@/app/admin/(dashboard)/products/[productId]/components/product-form'
import AdminImageUpload from '@/components/admin/ui/image-upload'
import StoreImageUpload from '@/components/native/image-upload'
import { widgetState } from '../../stubs/next-cloudinary'

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      useParams: () => ({ bannerId: 'b1', brandId: 'br1', categoryId: 'c1', productId: 'p1' }),
   }
})

vi.mock('react-hot-toast', () => ({
   toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

/* Radix locks body pointer-events while a select is open, which jsdom cannot
   recompute; the pointer-events check is disabled for these interactions. */
const user = () => userEvent.setup({ pointerEventsCheck: 0 })

const fetchSpy = (ok = true) =>
   vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(new Response('{}', { status: ok ? 200 : 500 })))

beforeEach(() => {
   widgetState.opens = 0
   widgetState.onSuccess = undefined
})

describe('admin BannerForm', () => {
   it('creates a banner and returns to the list', async () => {
      const fetchMock = fetchSpy()
      vi.stubGlobal('fetch', fetchMock)
      const { toast } = await import('react-hot-toast')

      render(<BannerForm initialData={null} />)

      expect(screen.getByText('Create banner')).toBeInTheDocument()

      await user().type(screen.getByPlaceholderText('Banner label'), 'Sale')

      /* The image field is driven by the (stubbed) upload widget. */
      widgetState.onSuccess?.({ info: { secure_url: 'https://cdn/x.png' } })

      await user().click(screen.getByRole('button', { name: 'Create' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })
      expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/banners')
      expect(toast.success).toHaveBeenCalledWith('Banner created.')
      vi.unstubAllGlobals()
   })

   it('patches an existing banner', async () => {
      const fetchMock = fetchSpy()
      vi.stubGlobal('fetch', fetchMock)

      render(
         <BannerForm
            initialData={{ id: 'b1', label: 'Sale', image: 'https://cdn/x.png' } as never}
         />
      )

      expect(screen.getByText('Edit banner')).toBeInTheDocument()

      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
            '/api/admin/banners/b1',
            expect.objectContaining({ method: 'PATCH' })
         ); }
      )
      vi.unstubAllGlobals()
   })

   it('deletes an existing banner after confirmation', async () => {
      const fetchMock = fetchSpy()
      vi.stubGlobal('fetch', fetchMock)
      const { toast } = await import('react-hot-toast')

      render(
         <BannerForm
            initialData={{ id: 'b1', label: 'Sale', image: 'https://cdn/x.png' } as never}
         />
      )

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))
      await user().click(destructive)

      await waitFor(() =>
         expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
      )
      await user().click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
            '/api/admin/banners/b1',
            expect.objectContaining({ method: 'DELETE' })
         ); }
      )
      expect(toast.success).toHaveBeenCalledWith('Banner deleted.')
      vi.unstubAllGlobals()
   })

   it('reports a failed delete with the banner hint', async () => {
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('nope')); }))
      const { toast } = await import('react-hot-toast')
      vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      render(
         <BannerForm
            initialData={{ id: 'b1', label: 'Sale', image: 'https://cdn/x.png' } as never}
         />
      )

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))
      await user().click(destructive)
      await waitFor(() =>
         expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
      )
      await user().click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith(
            'Make sure you removed all categories using this banner first.'
         ); }
      )
      vi.unstubAllGlobals()
   })
})

describe('admin BrandForm', () => {
   it('creates a brand', async () => {
      const fetchMock = fetchSpy()
      vi.stubGlobal('fetch', fetchMock)

      render(<BrandForm initialData={null} />)

      expect(screen.getByText('Create Brand')).toBeInTheDocument()

      await user().type(screen.getByPlaceholderText('Brand title'), 'Acme')
      await user().type(screen.getByPlaceholderText('Brand description'), 'Shoes')
      await user().type(
         screen.getByPlaceholderText('https://example.com/logo.png'),
         'https://cdn/logo.png'
      )

      await user().click(screen.getByRole('button', { name: 'Create' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })
      expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/brands')
      vi.unstubAllGlobals()
   })

   it('patches an existing brand', async () => {
      const fetchMock = fetchSpy()
      vi.stubGlobal('fetch', fetchMock)

      render(
         <BrandForm
            initialData={
               {
                  id: 'br1',
                  title: 'Acme',
                  description: 'Shoes',
                  logo: 'https://cdn/logo.png',
               }
            }
         />
      )

      expect(screen.getByText('Edit Brand')).toBeInTheDocument()
      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
            '/api/admin/brands/br1',
            expect.objectContaining({ method: 'PATCH' })
         ); }
      )
      vi.unstubAllGlobals()
   })

   it('reports non-OK brand save and delete responses', async () => {
      const fetchMock = fetchSpy(false)
      vi.stubGlobal('fetch', fetchMock)
      const { toast } = await import('react-hot-toast')

      render(
         <BrandForm
            initialData={{ id: 'br1', title: 'Acme', description: 'Shoes', logo: '' }}
         />
      )

      await user().click(screen.getByRole('button', { name: 'Save changes' }))
      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Something went wrong.'); })

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))
      await user().click(destructive)
      await user().click(await screen.findByRole('button', { name: 'Continue' }))
      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith(
            'Make sure you removed all products using this brand first.'
         ); }
      )
      vi.unstubAllGlobals()
   })

   it('deletes a brand', async () => {
      const fetchMock = fetchSpy()
      vi.stubGlobal('fetch', fetchMock)

      render(
         <BrandForm
            initialData={
               { id: 'br1', title: 'Acme', description: 'Shoes', logo: 'https://cdn/l.png' }
            }
         />
      )

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))
      await user().click(destructive)
      await waitFor(() =>
         expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
      )
      await user().click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
            '/api/admin/brands/br1',
            expect.objectContaining({ method: 'DELETE' })
         ); }
      )
      vi.unstubAllGlobals()
   })
})

describe('admin CategoryForm', () => {
   it('creates a category with a description', async () => {
      const fetchMock = fetchSpy()
      vi.stubGlobal('fetch', fetchMock)

      render(<CategoryForm initialData={null} />)

      expect(screen.getByText('Create category')).toBeInTheDocument()

      await user().type(screen.getByPlaceholderText('Category name'), 'Shoes')
      await user().type(screen.getByPlaceholderText('Category description'), 'Everyday shoes')

      await user().click(screen.getByRole('button', { name: 'Create' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })
      expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/categories')
      expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
         title: 'Shoes',
         description: 'Everyday shoes',
      })
      vi.unstubAllGlobals()
   })

   it('patches an existing category', async () => {
      const fetchMock = fetchSpy()
      vi.stubGlobal('fetch', fetchMock)

      render(
         <CategoryForm
            initialData={{ id: 'c1', title: 'Shoes', description: 'b1' } as never}
         />
      )

      expect(screen.getByText('Edit category')).toBeInTheDocument()
      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
            '/api/admin/categories/c1',
            expect.objectContaining({ method: 'PATCH' })
         ); }
      )
      vi.unstubAllGlobals()
   })

   it('reports non-OK category save and delete responses', async () => {
      const fetchMock = fetchSpy(false)
      vi.stubGlobal('fetch', fetchMock)
      const { toast } = await import('react-hot-toast')

      render(
         <CategoryForm
            initialData={{ id: 'c1', title: 'Shoes', description: 'b1' } as never}
         />
      )

      await user().click(screen.getByRole('button', { name: 'Save changes' }))
      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Something went wrong.'); })

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))
      await user().click(destructive)
      await user().click(await screen.findByRole('button', { name: 'Continue' }))
      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith(
            'Make sure you removed all products using this category first.'
         ); }
      )
      vi.unstubAllGlobals()
   })

   it('deletes a category', async () => {
      const fetchMock = fetchSpy()
      vi.stubGlobal('fetch', fetchMock)

      render(
         <CategoryForm
            initialData={{ id: 'c1', title: 'Shoes', description: 'b1' } as never}
         />
      )

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))
      await user().click(destructive)
      await waitFor(() =>
         expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
      )
      await user().click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
            '/api/admin/categories/c1',
            expect.objectContaining({ method: 'DELETE' })
         ); }
      )
      vi.unstubAllGlobals()
   })
})

describe('admin ProductForm', () => {
   const categories = [{ id: 'c1', title: 'Shoes' }]
   const brands = [{ id: 'br1', title: 'Acme' }]

   it('creates a product', async () => {
      const fetchMock = fetchSpy()
      vi.stubGlobal('fetch', fetchMock)

      render(<ProductForm categories={categories as never} brands={brands as never} initialData={null} />)

      expect(screen.getByText('Create product')).toBeInTheDocument()

      /* Images are optional; create the product with its required brand/category. */
      await user().clear(screen.getByPlaceholderText('Product title'))
      await user().type(screen.getByPlaceholderText('Product title'), 'Runner')
      await user().clear(screen.getAllByPlaceholderText('9.99')[0])
      await user().type(screen.getAllByPlaceholderText('9.99')[0], '20')
      await user().click(screen.getAllByRole('combobox')[0])
      await user().click(screen.getAllByText('Shoes').at(-1))
      await user().click(screen.getAllByRole('combobox')[1])
      await user().click(screen.getAllByText('Acme').at(-1))

      await user().click(screen.getByRole('button', { name: 'Create' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })
      expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/products')
      vi.unstubAllGlobals()
   })

   it('patches an existing product', async () => {
      const fetchMock = fetchSpy()
      vi.stubGlobal('fetch', fetchMock)

      render(
         <ProductForm
            categories={categories as never}
            brands={brands as never}
            initialData={
               {
                  id: 'p1',
                  title: 'Runner',
                  description: 'Fast',
                  price: 20,
                  discount: 0,
                  stock: 3,
                  images: ['https://cdn/p.png'],
                  categories,
                  categoryId: 'c1',
                  brandId: 'br1',
                  isAvailable: true,
                  isFeatured: false,
               } as never
            }
         />
      )

      expect(screen.getByText('Edit product')).toBeInTheDocument()

      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
            '/api/admin/products/p1',
            expect.objectContaining({ method: 'PATCH' })
         ); }
      )
      vi.unstubAllGlobals()
   })

   it('handles non-OK save/delete and archived product deletion on ProductForm', async () => {
      const { toast } = await import('react-hot-toast')
      vi.stubGlobal(
         'fetch',
         vi
            .fn()
            .mockResolvedValueOnce(new Response('{}', { status: 500 }))
            .mockResolvedValueOnce(new Response('{}', { status: 500 }))
            .mockResolvedValueOnce(
               Response.json({ archived: true }, { status: 200 })
            )
      )

      render(
         <ProductForm
            categories={categories as never}
            brands={brands as never}
            initialData={
               {
                  id: 'p1',
                  title: 'Runner',
                  description: 'Fast',
                  price: 20,
                  discount: 0,
                  stock: 3,
                  images: [],
                  categories: [],
                  categoryId: 'c1',
                  brandId: 'br1',
                  isAvailable: true,
                  isFeatured: false,
               } as never
            }
         />
      )

      await user().click(screen.getAllByRole('combobox')[0])
      const findAllByTextResult = await screen.findAllByText('Shoes')
      await user().click(findAllByTextResult.at(-1))
      await user().click(screen.getByRole('button', { name: 'Save changes' }))
      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Something went wrong.'); })

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))
      await user().click(destructive)
      await user().click(await screen.findByRole('button', { name: 'Continue' }))
      await waitFor(() => { expect(toast.error).toHaveBeenCalled(); })

      await user().click(destructive)
      await user().click(await screen.findByRole('button', { name: 'Continue' }))
      await waitFor(() => { expect(toast.success).toHaveBeenCalledWith('Product archived to preserve history.'); }
      )
      vi.unstubAllGlobals()
   })

   it('deletes a product', async () => {
      const fetchMock = fetchSpy()
      vi.stubGlobal('fetch', fetchMock)

      render(
         <ProductForm
            categories={categories as never}
            brands={brands as never}
            initialData={
               {
                  id: 'p1',
                  title: 'Runner',
                  description: 'Fast',
                  price: 20,
                  discount: 0,
                  stock: 3,
                  images: [],
                  categories,
                  categoryId: 'c1',
                  brandId: 'br1',
                  isAvailable: true,
                  isFeatured: false,
               } as never
            }
         />
      )

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))
      await user().click(destructive)
      await waitFor(() =>
         expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
      )
      await user().click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
            '/api/admin/products/p1',
            expect.objectContaining({ method: 'DELETE' })
         ); }
      )
      vi.unstubAllGlobals()
   })
})

describe('ImageUpload widgets', () => {
   it('lists the current images and removes one', () => {
      const onRemove = vi.fn()

      render(
         <AdminImageUpload value={['https://cdn/a.png']} onChange={vi.fn()} onRemove={onRemove} />
      )

      fireEvent.click(screen.getAllByRole('button')[0])

      expect(onRemove).toHaveBeenCalledWith('https://cdn/a.png')
   return Promise.resolve(); })

   it('opens the widget and forwards a successful upload', () => {
      const onChange = vi.fn()

      render(<AdminImageUpload value={[]} onChange={onChange} onRemove={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: /upload an image/i }))
      expect(widgetState.opens).toBe(1)

      widgetState.onSuccess?.({ info: { secure_url: 'https://cdn/new.png' } })
      expect(onChange).toHaveBeenCalledWith('https://cdn/new.png')
   })

   it('ignores a result without a secure url', () => {
      const onChange = vi.fn()

      render(<AdminImageUpload value={[]} onChange={onChange} onRemove={vi.fn()} />)

      widgetState.onSuccess?.({ info: {} })
      widgetState.onSuccess?.()

      expect(onChange).not.toHaveBeenCalled()
   })

   it('the storefront widget behaves the same way', () => {
      const onChange = vi.fn()
      const onRemove = vi.fn()

      render(
         <StoreImageUpload value={['https://cdn/a.png']} onChange={onChange} onRemove={onRemove} />
      )

      fireEvent.click(screen.getAllByRole('button').at(-1))
      expect(widgetState.opens).toBe(1)
      widgetState.onSuccess?.({ info: { secure_url: 'https://cdn/store.png' } })
      expect(onChange).toHaveBeenCalledWith('https://cdn/store.png')
   })
})
