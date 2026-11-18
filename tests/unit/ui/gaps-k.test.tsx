import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ProductForm } from '@/app/admin/(dashboard)/products/[productId]/components/product-form'
import { UserForm as AdminUserForm } from '@/app/admin/(dashboard)/users/[userId]/components/user-form'
import { UserContextProvider, useUserContext } from '@/state/User'
import { toast, useToast } from '@/components/ui/use-toast'
import { widgetState } from '../../stubs/next-cloudinary'
import { routerMock } from '../support/navigation'

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      useParams: () => ({ productId: 'p1', userId: 'u1' }),
      usePathname: () => '/admin/products',
   }
})

vi.mock('react-hot-toast', () => ({
   toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

describe('admin product form image list', () => {
   it('appends an upload and removes it again', async () => {
      render(<ProductForm categories={[{ id: 'c1', title: 'Shoes' }] as never} initialData={null} />)

      act(() => {
         widgetState.onSuccess?.({ info: { secure_url: 'https://cdn/first.png' } })
      })

      /* One thumbnail now exists: its trash button removes that very URL. */
      await waitFor(() =>
         expect(
            screen.getAllByRole('button').filter((b) => b.className.includes('destructive'))
         ).toHaveLength(1)
      )

      act(() => {
         widgetState.onSuccess?.({ info: { secure_url: 'https://cdn/second.png' } })
      })

      await waitFor(() =>
         expect(
            screen.getAllByRole('button').filter((b) => b.className.includes('destructive'))
         ).toHaveLength(2)
      )
   })

   it('reports a failed delete with the generic message', async () => {
      const { toast: hot } = await import('react-hot-toast')
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('nope'))))

      render(
         <ProductForm
            categories={[{ id: 'c1', title: 'Shoes' }] as never}
            initialData={
               {
                  id: 'p1',
                  title: 'Shoe',
                  description: 'Blue',
                  price: 100,
                  discount: 0,
                  images: ['https://cdn/a.png'],
                  isFeatured: false,
                  isAvailable: true,
                  brandId: 'b1',
                  categories: [{ id: 'c1' }],
               } as never
            }
         />
      )

      const destructive = screen
         .getAllByRole('button')
         .filter((button) => button.className.includes('destructive'))
      await user().click(destructive[0])
      await user().click(await screen.findByRole('button', { name: 'Continue' }))

      await waitFor(() => expect(hot.error).toHaveBeenCalledWith('Something went wrong.'))
      vi.unstubAllGlobals()
   })

   it('reports a rejected save with the generic message', async () => {
      const { toast: hot } = await import('react-hot-toast')
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('nope'))))

      render(<ProductForm categories={[{ id: 'c1', title: 'Shoes' }] as never} initialData={null} />)

      /* price, stock and category are required before the submit handler runs */
      await user().type(screen.getByPlaceholderText('Product title'), 'Shoe')
      await user().type(screen.getAllByPlaceholderText('9.99')[0], '100')

      const stock = screen.getByPlaceholderText('10')
      await user().clear(stock)
      await user().type(stock, '5')

      await user().click(screen.getByRole('combobox'))
      await user().click((await screen.findAllByText('Shoes')).at(-1)!)

      await user().click(screen.getByRole('button', { name: /create/i }))

      await waitFor(() => expect(hot.error).toHaveBeenCalledWith('Something went wrong.'))
      vi.unstubAllGlobals()
   })
})

describe('admin user form error normalisation', () => {
   it('surfaces a non-Error rejection as the generic message', async () => {
      const { toast: hot } = await import('react-hot-toast')
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject('offline')))

      render(
         <AdminUserForm
            initialData={
               { id: 'u1', name: 'Ada', email: 'a@b.co', phone: '0912', isBanned: false } as never
            }
         />
      )

      await user().click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => expect(hot.error).toHaveBeenCalledWith('Something went wrong.'))
      vi.unstubAllGlobals()
   })
})

describe('user context refresh adapter', () => {
   it('refreshUser kicks off a fetch without being awaited', async () => {
      document.cookie = 'logged-in=true'
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'u1', name: 'Ada' })))
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => useUserContext(), { wrapper: UserContextProvider })

      await waitFor(() => expect(result.current.user).not.toBeNull())

      await act(async () => {
         result.current.refreshUser()
      })

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      vi.unstubAllGlobals()
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
   })

   it('is a guest without a session cookie so no fetch happens', async () => {
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => useUserContext(), { wrapper: UserContextProvider })

      expect(result.current.user).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
   })
})

describe('toast retention timer', () => {
   it('drops a closed toast from the store after the delay', async () => {
      const { result } = renderHook(() => useToast())

      act(() => {
         toast({ title: 'expiring' })
      })

      await waitFor(() => expect(result.current.toasts.length).toBe(1))

      const entry = result.current.toasts[0]

      /* Closing schedules REMOVE_TOAST; the removal runs on the retention
         timer, which is one million milliseconds out. */
      vi.useFakeTimers()
      act(() => {
         entry.onOpenChange?.(false)
         vi.advanceTimersByTime(1_000_001)
      })
      vi.useRealTimers()

      await waitFor(() => expect(result.current.toasts.length).toBe(0))
   })
})

describe('user context refreshUser guards', () => {
   it('does nothing for a guest', async () => {
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => useUserContext(), { wrapper: UserContextProvider })

      await act(async () => {
         result.current.refreshUser()
      })

      expect(fetchMock).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
   })

   it('logs a failure from the manual refresh path', async () => {
      document.cookie = 'logged-in=true'
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const fetchMock = vi
         .fn()
         .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u1', name: 'Ada' })))
         .mockRejectedValueOnce(new Error('offline'))
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => useUserContext(), { wrapper: UserContextProvider })

      await waitFor(() => expect(result.current.user).not.toBeNull())

      await act(async () => {
         result.current.refreshUser()
      })

      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      vi.unstubAllGlobals()
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      errorSpy.mockRestore()
   })
})

describe('user context cancellation', () => {
   it('ignores a profile response that lands after unmount', async () => {
      document.cookie = 'logged-in=true'
      let release: (value: Response) => void = () => {}
      const pending = new Promise<Response>((resolve) => {
         release = resolve
      })
      vi.stubGlobal('fetch', vi.fn(() => pending))

      const { result, unmount } = renderHook(() => useUserContext(), {
         wrapper: UserContextProvider,
      })

      unmount()

      /* The in-flight response resolves after the effect cleaned up. */
      release(new Response(JSON.stringify({ id: 'u1', name: 'Late' })))
      await act(async () => {
         await Promise.resolve()
      })

      expect(result.current.user).toBeNull()
      vi.unstubAllGlobals()
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
   })
})

describe('user context with an empty profile payload', () => {
   it('keeps the user null when the API answers null', async () => {
      document.cookie = 'logged-in=true'
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(null))))

      const { result } = renderHook(() => useUserContext(), { wrapper: UserContextProvider })

      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())

      await act(async () => {
         result.current.refreshUser()
      })

      expect(result.current.user).toBeNull()
      vi.unstubAllGlobals()
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
   })
})

describe('user context mount failure', () => {
   it('logs a rejected profile fetch', async () => {
      document.cookie = 'logged-in=true'
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      const { result } = renderHook(() => useUserContext(), { wrapper: UserContextProvider })

      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      expect(result.current.user).toBeNull()

      vi.unstubAllGlobals()
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      errorSpy.mockRestore()
   })
})
