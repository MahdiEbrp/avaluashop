import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import EditProfilePage from '@/app/(store)/(routes)/profile/edit/page'
import { UserNav } from '@/components/native/nav/user'
import AdminImageUpload from '@/components/admin/ui/image-upload'
import { routerMock } from '../support/navigation'

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return { ...actual, ...navigation, usePathname: () => '/profile/edit' }
})

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

afterEach(() => {
   vi.unstubAllGlobals()
   document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('profile edit page loader', () => {
   it('logs a refused profile read', async () => {
      document.cookie = 'logged-in=true'
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }))

      render(<EditProfilePage />)

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      errorSpy.mockRestore()
   })

   it('renders the edit card once the profile arrives', async () => {
      document.cookie = 'logged-in=true'
      vi.stubGlobal(
         'fetch',
         vi.fn(
            () =>
               Promise.resolve(Response.json({ id: 'u1', name: 'Ada', phone: '0912', email: 'a@b.co' }))
         )
      )

      render(<EditProfilePage />)

      expect(await screen.findByRole('button', { name: /save changes/i })).toBeInTheDocument()
   })
})

describe('storefront user nav logout', () => {
   it('reloads after a successful logout', async () => {
      const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)
      const reload = vi.fn()
      vi.stubGlobal('location', { ...globalThis.location, reload, origin: 'http://localhost' })

      render(<UserNav />)
      await user().click(screen.getByRole('button'))

      const logout = await screen.findByText('خروج از حساب')
      await user().click(logout)

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { cache: 'no-store' }); }
      )
      await waitFor(() => { expect(reload).toHaveBeenCalled(); })
   })

   it('does not reload when the server refuses', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))))
      const reload = vi.fn()
      vi.stubGlobal('location', { ...globalThis.location, reload, origin: 'http://localhost' })

      render(<UserNav />)
      await user().click(screen.getByRole('button'))
      await user().click(await screen.findByText('خروج از حساب'))

      await waitFor(() => { expect(globalThis.fetch).toHaveBeenCalled(); })
      expect(reload).not.toHaveBeenCalled()
   })

   it('logs a network failure', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }))

      render(<UserNav />)
      await user().click(screen.getByRole('button'))
      await user().click(await screen.findByText('خروج از حساب'))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      errorSpy.mockRestore()
   })

   it('links to each profile section', async () => {
      render(<UserNav />)
      await user().click(screen.getByRole('button'))

      expect(
         await screen.findByRole('menuitem', { name: /ویرایش حساب کاربری/i })
      ).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /سفارش‌های من/i })).toBeInTheDocument()
   })

   it('leaves the router alone', () => {
      render(<UserNav />)

      expect(routerMock.push).not.toHaveBeenCalled()
   })
})

describe('compare image without a position callback', () => {
   /* The default `noop` handler is only reachable when the caller omits
      onSliderPositionChange, which no real page does. */
   it('slides without a callback', async () => {
      const { default: CompareImage } = await import('@/components/native/CompareImage')

      class Observer {
         static live: Observer[] = []
         cb: ResizeObserverCallback
         constructor(cb: ResizeObserverCallback) {
            this.cb = cb
            Observer.live.push(this)
         }
         observe() {/* noop */ }
         unobserve() {/* noop */ }
         disconnect() {/* noop */ }
         fire(width: number) {
            this.cb(
               [{ target: { getBoundingClientRect: () => ({ width, height: width }) } }] as never,
               this
            )
         }
      }

      vi.stubGlobal('ResizeObserver', Observer)
      Object.defineProperty(HTMLImageElement.prototype, 'complete', {
         configurable: true,
         get: () => false,
      })

      const { container } = render(<CompareImage leftImage="/l.png" rightImage="/r.png" />)

      const left = container.querySelector('[data-testid="left-image"]')
      const right = container.querySelector('[data-testid="right-image"]')

      await act(() => {
         fireEvent.load(left)
         fireEvent.load(right)
      return Promise.resolve(); })
      await act(() => {
         for (const observer of Observer.live) observer.fire(400)
      return Promise.resolve(); })

      const surface = container.querySelector('[data-testid="container"]')
      await act(() => {
         fireEvent.mouseDown(surface, { pageX: 200, pageY: 0 })
         fireEvent.mouseUp(document)
      return Promise.resolve(); })

      expect(surface).toBeInTheDocument()
   })
})

describe('profile pages for a signed-out visitor', () => {
   it('never fetches the order list', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const { default: ProfileOrdersPage } = await import(
         '@/app/(store)/(routes)/profile/orders/page'
      )
      render(<ProfileOrdersPage />)

      expect(fetchMock).not.toHaveBeenCalled()
   })

   it('never fetches a single order', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const { default: ProfileOrderPage } = await import(
         '@/app/(store)/(routes)/profile/orders/[orderId]/page'
      )
      await act(() => {
         render(<ProfileOrderPage params={Promise.resolve({ orderId: 'o1' })} />)
      return Promise.resolve(); })

      expect(fetchMock).not.toHaveBeenCalled()
   })
})

describe('admin logout button', () => {
   it('does not reload when the server refuses', async () => {
      const { LogoutButton } = await import('@/components/admin/logout-button')
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))))
      const reload = vi.fn()
      vi.stubGlobal('location', { ...globalThis.location, reload, origin: 'http://localhost' })

      render(<LogoutButton />)
      await user().click(screen.getByRole('button'))

      await waitFor(() => { expect(globalThis.fetch).toHaveBeenCalled(); })
      expect(reload).not.toHaveBeenCalled()
   })
})

describe('image upload without a secure url', () => {
   it('leaves the field alone when the widget reports no url', async () => {
      const { widgetState } = await import('../../stubs/next-cloudinary')
      const onChange = vi.fn()

      render(
         <AdminImageUpload disabled={false} value={[]} onChange={onChange} onRemove={vi.fn()} />
      )

      await waitFor(() =>
         expect(screen.getByRole('button', { name: /upload an image/i })).toBeInTheDocument()
      )

      act(() => {
         widgetState.onSuccess?.({ info: {} })
      })
      act(() => {
         widgetState.onSuccess?.()
      })

      expect(onChange).not.toHaveBeenCalled()
   })
})
