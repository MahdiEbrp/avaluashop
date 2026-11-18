import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AvailableToggle, BrandCombobox, CategoriesCombobox, SortBy } from '@/app/(store)/(routes)/products/components/options'
import { DataTable } from '@/components/ui/data-table'
import { DataTable as AdminDataTable } from '@/components/admin/ui/data-table'
import { reducer, toast, useToast } from '@/components/ui/use-toast'
import { useIsClient } from '@/hooks/use-is-client'
import { useLocalCart, publishLocalCart } from '@/hooks/use-local-cart'
import { useOrigin } from '@/hooks/use-origin'
import { useAuthenticated } from '@/hooks/useAuthentication'
import StoreImageUpload from '@/components/native/image-upload'
import { widgetState } from '../../stubs/next-cloudinary'
import { routerMock } from '../support/navigation'

const params = new URLSearchParams()

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      useSearchParams: () => params,
      usePathname: () => '/products',
   }
})

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

const resetParams = (init: Record<string, string> = {}) => {
   for (const key of [...params.keys()]) params.delete(key)
   for (const [k, v] of Object.entries(init)) params.set(k, v)
}

beforeEach(() => {
   resetParams()
   routerMock.replace.mockClear()
})

describe('catalog filter controls', () => {
   it('SortBy applies a new ordering', async () => {
      render(<SortBy initialData="featured" />)

      await user().click(screen.getByRole('combobox'))
      await user().click(await screen.findByText('Most Expensive'))

      expect(routerMock.replace).toHaveBeenCalledWith('/products?sort=most_expensive', {
         scroll: false,
      })
   })

   it('SortBy clears the filter when the same value is chosen', async () => {
      render(<SortBy initialData="featured" />)

      await user().click(screen.getByRole('combobox'))
      await user().click(await screen.findByText('Featured'))

      expect(routerMock.replace).toHaveBeenCalledWith('/products', { scroll: false })
   })

   it('SortBy falls back to featured without a parameter', () => {
      render(<SortBy initialData="" />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
   })

   it('CategoriesCombobox narrows the catalogue', async () => {
      render(
         <CategoriesCombobox
            initialCategory=""
            categories={[{ id: 'c1', title: 'Shoes' }]}
         />
      )

      expect(screen.getByText('Select category...')).toBeInTheDocument()

      await user().click(screen.getByRole('combobox'))
      await user().click(await screen.findByText('Shoes'))

      expect(routerMock.replace).toHaveBeenCalledWith('/products?category=Shoes', {
         scroll: false,
      })
   })

   it('CategoriesCombobox shows the active category title', () => {
      render(
         <CategoriesCombobox
            initialCategory="Shoes"
            categories={[{ id: 'c1', title: 'Shoes' }]}
         />
      )

      expect(screen.getByRole('combobox')).toHaveTextContent('Shoes')
   })

   it('CategoriesCombobox clears an already-selected category', async () => {
      render(
         <CategoriesCombobox initialCategory="shoes" categories={[{ id: 'c1', title: 'shoes' }]} />
      )

      await user().click(screen.getByRole('combobox'))
      await user().click(screen.getAllByText('shoes').at(-1)!)

      expect(routerMock.replace).toHaveBeenCalledWith('/products', { scroll: false })
   })

   it('BrandCombobox narrows the catalogue', async () => {
      render(<BrandCombobox initialBrand="" brands={[{ id: 'b1', title: 'Acme' }]} />)

      expect(screen.getByText('Select brand...')).toBeInTheDocument()

      await user().click(screen.getByRole('combobox'))
      await user().click(await screen.findByText('Acme'))

      expect(routerMock.replace).toHaveBeenCalledWith('/products?brand=Acme', { scroll: false })
   })

   it('BrandCombobox shows the active brand and clears it', async () => {
      render(<BrandCombobox initialBrand="acme" brands={[{ id: 'b1', title: 'acme' }]} />)

      expect(screen.getByRole('combobox')).toHaveTextContent('acme')

      await user().click(screen.getByRole('combobox'))
      await user().click(screen.getAllByText('acme').at(-1)!)

      expect(routerMock.replace).toHaveBeenCalledWith('/products', { scroll: false })
   })

   it('AvailableToggle only includes available products', async () => {
      render(<AvailableToggle initialData="false" />)

      await user().click(screen.getByRole('switch'))

      expect(routerMock.replace).toHaveBeenCalledWith('/products?isAvailable=true', {
         scroll: false,
      })
   })

   it('AvailableToggle starts checked when the filter is on', () => {
      render(<AvailableToggle initialData="true" />)

      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked')
   })
})

describe('data tables', () => {
   const columns = [
      { accessorKey: 'name', header: 'Name' },
      {
         id: 'actions',
         cell: ({ row }: { row: { original: { name: string } } }) => (
            <span data-testid="cell">{row.original.name.toUpperCase()}</span>
         ),
      },
   ]

   it('drives the column filter from the search box', () => {
      render(
         <DataTable
            columns={columns as never}
            data={[{ name: 'alpha' }, { name: 'beta' }]}
            searchKey="name"
         />
      )

      expect(screen.getByText('alpha')).toBeInTheDocument()

      fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'alp' } })

      /* The value round-trips through the table's column filter state. */
      expect(screen.getByPlaceholderText('Search')).toHaveValue('alp')
   })

   it('shows the empty state without rows', () => {
      render(<DataTable columns={columns as never} data={[]} searchKey="name" />)

      expect(screen.getByText('No results.')).toBeInTheDocument()
   })

   it('paginates with previous and next', async () => {
      const rows = Array.from({ length: 15 }, (_, index) => ({ name: `row-${index}` }))

      render(<DataTable columns={columns as never} data={rows} searchKey="name" />)

      const next = screen.getByRole('button', { name: 'Next' })
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

      await user().click(next)

      await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled())
   })

   it('the admin table renders rows without the search box', () => {
      render(<AdminDataTable columns={columns as never} data={[{ name: 'alpha' }]} />)

      expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument()
      expect(screen.getByText('alpha')).toBeInTheDocument()
   })

   it('the admin table paginates forward and back', async () => {
      const rows = Array.from({ length: 15 }, (_, index) => ({ name: `row-${index}` }))

      render(<AdminDataTable columns={columns as never} data={rows} />)

      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

      await user().click(screen.getByRole('button', { name: 'Next' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'Previous' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled())
   })

   it('the admin table shows its empty state without rows', () => {
      render(<AdminDataTable columns={columns as never} data={[]} />)

      expect(screen.getByText('No results.')).toBeInTheDocument()
   })

   it('the storefront table pages back after moving forward', async () => {
      const rows = Array.from({ length: 15 }, (_, index) => ({ name: `row-${index}` }))

      render(<DataTable columns={columns as never} data={rows} searchKey="name" />)

      await user().click(screen.getByRole('button', { name: 'Next' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'Previous' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled())
   })
})

describe('toast store', () => {
   it('the reducer caps the stack at one toast', () => {
      const state = reducer(
         { toasts: [{ id: '1', open: true }] },
         { type: 'ADD_TOAST', toast: { id: '2', open: true } }
      )

      expect(state.toasts).toHaveLength(1)
      expect(state.toasts[0].id).toBe('2')
   })

   it('updates a toast in place', () => {
      const state = reducer(
         { toasts: [{ id: '1', open: true, title: 'old' }] },
         { type: 'UPDATE_TOAST', toast: { id: '1', title: 'new' } }
      )

      expect(state.toasts[0].title).toBe('new')
   })

   it('leaves other toasts untouched when the id does not match', () => {
      const untouched = { id: '2', open: true, title: 'keep' }
      const state = reducer(
         { toasts: [untouched] },
         { type: 'UPDATE_TOAST', toast: { id: '1', title: 'new' } }
      )

      expect(state.toasts[0]).toBe(untouched)
   })

   it('dismisses every toast when no id is given', () => {
      const state = reducer(
         { toasts: [{ id: '1', open: true }, { id: '2', open: true }] },
         { type: 'DISMISS_TOAST' }
      )

      expect(state.toasts.every((item) => item.open === false)).toBe(true)
   })

   it('removes every toast when no id is given', () => {
      const state = reducer({ toasts: [{ id: '1', open: false }] }, { type: 'REMOVE_TOAST' })

      expect(state.toasts).toEqual([])
   })

   it('removes only the matching toast', () => {
      const state = reducer(
         { toasts: [{ id: '1', open: false }, { id: '2', open: false }] },
         { type: 'REMOVE_TOAST', toastId: '1' }
      )

      expect(state.toasts.map((item) => item.id)).toEqual(['2'])
   })

   it('a toast can be updated and dismissed through its handle', async () => {
      const handle = toast({ title: 'hello' })

      act(() => {
         handle.update({ id: handle.id, title: 'updated' })
      })

      await waitFor(() => expect(handle.id).toBeTruthy())
      act(() => {
         handle.dismiss()
      })
   })

   it('useToast exposes the live state and dispatch helpers', async () => {
      const Harness = () => {
         const { toasts, toast: push, dismiss } = useToast()

         return (
            <div>
               <p data-testid="count">{toasts.length}</p>
               <button
                  onClick={() => {
                     push({ title: 'pushed' })
                  }}
               >
                  push
               </button>
               <button
                  onClick={() => {
                     dismiss()
                  }}
               >
                  dismiss all
               </button>
               <button
                  onClick={() => {
                     dismiss('1')
                  }}
               >
                  dismiss one
               </button>
            </div>
         )
      }

      render(<Harness />)
      await user().click(screen.getByText('push'))
      await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))

      await user().click(screen.getByText('dismiss one'))
      await user().click(screen.getByText('dismiss all'))
   })
})

describe('browser-state hooks', () => {
   it('useIsClient is true after hydration', () => {
      const Harness = () => <p>{String(useIsClient())}</p>

      render(<Harness />)

      expect(screen.getByText('true')).toBeInTheDocument()
   })

   it('useOrigin reports the jsdom origin', () => {
      const Harness = () => <p>{useOrigin()}</p>

      render(<Harness />)

      expect(screen.getByText(window.location.origin)).toBeInTheDocument()
   })

   it('useAuthenticated reads the cookie synchronously', () => {
      document.cookie = 'logged-in=true'
      const Harness = () => <p>{String(useAuthenticated().authenticated)}</p>

      render(<Harness />)

      expect(screen.getByText('true')).toBeInTheDocument()
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
   })

   it('useAuthenticated survives a document without cookies', () => {
      const descriptor = Object.getOwnPropertyDescriptor(document, 'cookie')
      Object.defineProperty(document, 'cookie', {
         configurable: true,
         get() {
            throw new Error('blocked')
         },
      })
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const Harness = () => <p>{String(useAuthenticated().authenticated)}</p>

      render(<Harness />)

      expect(screen.getByText('false')).toBeInTheDocument()
      expect(errorSpy).toHaveBeenCalled()
      if (descriptor) Object.defineProperty(document, 'cookie', descriptor)
      errorSpy.mockRestore()
   })

   it('useLocalCart tracks writes and storage events', async () => {
      const Harness = () => {
         const cart = useLocalCart()

         return <p data-testid="items">{cart?.items.length ?? -1}</p>
      }

      render(<Harness />)
      expect(screen.getByTestId('items')).toHaveTextContent('0')

      act(() => {
         publishLocalCart({ items: [{ productId: 'p1', count: 1 }] })
      })

      await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('1'))

      act(() => {
         localStorage.setItem('Cart', JSON.stringify({ items: [] }))
         globalThis.dispatchEvent(new Event('storage'))
      })

      await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('0'))
   })

   it('useLocalCart normalises a corrupt store', async () => {
      localStorage.setItem('Cart', '{not json')
      const Harness = () => {
         const cart = useLocalCart()

         return <p data-testid="items">{cart?.items.length ?? -1}</p>
      }

      render(<Harness />)

      await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('0'))
   })
})

describe('storefront image upload remove', () => {
   it('removes a stored image', () => {
      const onRemove = vi.fn()

      render(
         <StoreImageUpload
            value={['https://cdn/a.png']}
            onChange={vi.fn()}
            onRemove={onRemove}
         />
      )

      fireEvent.click(screen.getAllByRole('button')[0])

      expect(onRemove).toHaveBeenCalledWith('https://cdn/a.png')
      expect(widgetState.onSuccess).toBeTypeOf('function')
   })

   it('forwards a secure url from the widget', () => {
      const onChange = vi.fn()

      render(
         <StoreImageUpload value={[]} onChange={onChange} onRemove={vi.fn()} />
      )

      act(() => {
         widgetState.onSuccess?.({ info: { secure_url: 'https://cdn/b.png' } })
      })

      expect(onChange).toHaveBeenCalledWith('https://cdn/b.png')
   })

   it('ignores a widget result without a secure url', () => {
      const onChange = vi.fn()

      render(
         <StoreImageUpload value={[]} onChange={onChange} onRemove={vi.fn()} />
      )

      act(() => {
         widgetState.onSuccess?.({ info: {} })
      })
      act(() => {
         widgetState.onSuccess?.(undefined)
      })

      expect(onChange).not.toHaveBeenCalled()
   })
})
