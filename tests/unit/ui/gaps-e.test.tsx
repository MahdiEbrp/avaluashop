import { renderToString } from 'react-dom/server'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
   CommandDialog as AdminCommandDialog,
   CommandInput as AdminCommandInput,
   CommandItem as AdminCommandItem,
   CommandList as AdminCommandList,
} from '@/components/admin/ui/command'
import {
   DropdownMenu,
   DropdownMenuCheckboxItem,
   DropdownMenuContent,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuSub,
   DropdownMenuSubContent,
   DropdownMenuSubTrigger,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
   DropdownMenuCheckboxItem as AdminDropdownMenuCheckboxItem,
   DropdownMenuContent as AdminDropdownMenuContent,
   DropdownMenuSub as AdminDropdownMenuSub,
   DropdownMenuSubContent as AdminDropdownMenuSubContent,
   DropdownMenuSubTrigger as AdminDropdownMenuSubTrigger,
   DropdownMenuTrigger as AdminDropdownMenuTrigger,
   DropdownMenu as AdminDropdownMenu,
   DropdownMenuRadioItem as AdminDropdownMenuRadioItem,
   DropdownMenuRadioGroup as AdminDropdownMenuRadioGroup,
} from '@/components/admin/ui/dropdown-menu'
import { Separator as AdminSelectSeparatorTrigger } from '@/components/admin/ui/separator'
import { SelectSeparator } from '@/components/admin/ui/select'
import { AlertModal as StoreAlertModal } from '@/components/modals/alert-modal'
import { AlertModal as AdminAlertModal } from '@/components/admin/modals/alert-modal'
import { Modal } from '@/components/admin/ui/modal'
import AdminImageUpload from '@/components/admin/ui/image-upload'
import StoreImageUpload from '@/components/native/image-upload'
import { ModalProvider } from '@/providers/modal-provider'
import { useIsClient } from '@/hooks/use-is-client'
import { useOrigin } from '@/hooks/use-origin'
import { useLocalCart } from '@/hooks/use-local-cart'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { useUserContext, UserContextProvider } from '@/state/User'
import { useCartContext, CartContextProvider } from '@/state/Cart'
import { useFormField } from '@/components/ui/form'
import { useFormField as useAdminFormField } from '@/components/admin/ui/form'
import { toast, useToast } from '@/components/ui/use-toast'
import { FormProvider, useForm } from 'react-hook-form'

/* A FormProvider without the surrounding <FormField>: enough for
   useFormContext() to succeed so the field-context guard is what throws. */
function BareFormWrapper({ children }: { children: React.ReactNode }) {
   const form = useForm({ defaultValues: { field: '' } })

   return <FormProvider {...form}>{children}</FormProvider>
}

vi.mock('react-hot-toast', () => ({
   toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

describe('server snapshots', () => {
   /* `renderToString` runs the server snapshot, which never runs in jsdom. */
   it('useIsClient reports false while server rendering', () => {
      function Probe() {
         return <p>{String(useIsClient())}</p>
      }

      expect(renderToString(<Probe />)).toContain('false')
   })

   it('useOrigin is empty while server rendering', () => {
      function Probe() {
         return <p>origin:&quot;{useOrigin()}&quot;</p>
      }

      expect(renderToString(<Probe />)).toContain('origin:&quot;<!-- -->&quot;')
   })

   it('useLocalCart is null while server rendering', () => {
      function Probe() {
         const cart = useLocalCart()
         return <p>cart:{cart === null ? 'null' : 'present'}</p>
      }

      expect(renderToString(<Probe />)).toContain('cart:<!-- -->null')
   })

   it('useAuthenticated is false while server rendering', () => {
      document.cookie = 'logged-in=true'

      function Probe() {
         return <p>{String(useAuthenticated().authenticated)}</p>
      }

      expect(renderToString(<Probe />)).toContain('false')
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
   })
})

describe('client-only guards before hydration', () => {
   /* Each guard renders null on the server pass. `renderToString` exercises
      exactly that pass, which jsdom never does. */
   it('every hydration guard renders nothing on the server', () => {
      const html = renderToString(
         <>
            <StoreAlertModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} loading={false} />
            <AdminAlertModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} loading={false} />
            <AdminImageUpload
               disabled={false}
               value={[]}
               onChange={vi.fn()}
               onRemove={vi.fn()}
            />
            <StoreImageUpload value={[]} onChange={vi.fn()} onRemove={vi.fn()} />
            <ModalProvider />
         </>
      )

      expect(html).toBe('')
   })

   it('both render their children after hydration', async () => {
      render(
         <>
            <ModalProvider />
            <StoreAlertModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} loading={false} />
            <AdminImageUpload
               disabled={false}
               value={[]}
               onChange={vi.fn()}
               onRemove={vi.fn()}
            />
         </>
      )

      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/upload an image/i)).toBeInTheDocument()
   })
})

describe('default contexts without a provider', () => {
   it('useUserContext exposes inert defaults', async () => {
      const { result } = renderHook(() => useUserContext())

      expect(result.current.user).toBeNull()
      expect(result.current.loading).toBe(true)

      /* The no-op refresher resolves without touching the network. */
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      await act(async () => {
         await result.current.refreshUser()
      })
      expect(fetchMock).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
   })

   it('useCartContext exposes inert defaults', () => {
      const { result } = renderHook(() => useCartContext())

      expect(result.current.cart).toBeNull()
      expect(result.current.loading).toBe(true)
      expect(() => {
         result.current.refreshCart()
         result.current.dispatchCart({ items: [] })
      }).not.toThrow()
   })

   it('UserContextProvider refreshes through the API', async () => {
      document.cookie = 'logged-in=true'
      const fetchMock = vi.fn(() => Promise.resolve(Response.json({ id: 'u1', name: 'Ada' })))
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => useUserContext(), {
         wrapper: UserContextProvider,
      })

      await waitFor(() => { expect(result.current.user).not.toBeNull(); })
      expect(result.current.user).toEqual({ id: 'u1', name: 'Ada' })
      vi.unstubAllGlobals()
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
   })

   it('UserContextProvider logs a refused profile read', async () => {
      document.cookie = 'logged-in=true'
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }))

      renderHook(() => useUserContext(), { wrapper: UserContextProvider })

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      vi.unstubAllGlobals()
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      errorSpy.mockRestore()
   })

   it('CartContextProvider publishes guest changes into localStorage', async () => {
      const { result } = renderHook(() => useCartContext(), {
         wrapper: CartContextProvider,
      })

      await waitFor(() => { expect(result.current.loading).toBe(false); })

      await act(() => {
         result.current.dispatchCart({
            items: [
               {
                  productId: 'p1',
                  count: 2,
                  product: { id: 'p1', title: 'Shoe', images: ['/a.png'], description: 'Blue' },
               },
            ],
         })
      return Promise.resolve(); })

      expect(JSON.parse(localStorage.getItem('Cart'))).toMatchObject({
         items: [expect.objectContaining({ productId: 'p1', count: 2 })],
      })
   })
})

describe('useFormField outside a form', () => {
   /* The field context defaults to `{}`, so the "must be used within
      <FormField>" guard cannot fire; the missing FormProvider is what throws. */
   it('fails loudly for the storefront form helper', () => {
      expect(() => renderHook(() => useFormField())).toThrow()
   })

   it('fails loudly for the admin form helper', () => {
      expect(() => renderHook(() => useAdminFormField())).toThrow()
   })


})

describe('toast removal queue', () => {
   it('removes a toast after the retention delay', async () => {
      const { result } = renderHook(() => useToast())

      act(() => {
         toast({ title: 'queued' })
      })

      await waitFor(() => { expect(result.current.toasts.length).toBe(1); })

      /* Dismissing schedules the removal timer that clears the queue. */
      act(() => {
         toast({ title: 'second' })
      })

      const item = result.current.toasts[0]
      act(() => {
         item.onOpenChange?.(false)
      })

      await waitFor(() => { expect(result.current.toasts.every((t) => !t.open)).toBe(true); })
   })

   it('exposes a dismiss handle that closes its toast', async () => {
      const { result } = renderHook(() => useToast())

      let handle!: ReturnType<typeof toast>
      act(() => {
         handle = toast({ title: 'dismissable' })
      })

      await waitFor(() => { expect(result.current.toasts.length).toBe(1); })

      act(() => {
         handle.dismiss()
      })

      await waitFor(() => { expect(result.current.toasts.every((t) => !t.open)).toBe(true); })
   })
})

describe('dropdown submenus', () => {
   it('renders the storefront inset sub-trigger', async () => {
      render(
         <DropdownMenu open>
            <DropdownMenuTrigger>open</DropdownMenuTrigger>
            <DropdownMenuContent>
               <DropdownMenuSub open>
                  <DropdownMenuSubTrigger inset>More</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                     <p>nested</p>
                  </DropdownMenuSubContent>
               </DropdownMenuSub>
            </DropdownMenuContent>
         </DropdownMenu>
      )

      expect(await screen.findByText('More')).toBeInTheDocument()
   })

   it('renders the storefront checkbox and radio items', async () => {
      const onChecked = vi.fn()

      render(
         <DropdownMenu open>
            <DropdownMenuTrigger>open</DropdownMenuTrigger>
            <DropdownMenuContent>
               <DropdownMenuCheckboxItem checked onCheckedChange={onChecked}>
                  Show hidden
               </DropdownMenuCheckboxItem>
               <DropdownMenuRadioGroup value="a">
                  <DropdownMenuRadioItem value="a">Option A</DropdownMenuRadioItem>
               </DropdownMenuRadioGroup>
            </DropdownMenuContent>
         </DropdownMenu>
      )

      await user().click(await screen.findByText('Show hidden'))
      expect(onChecked).toHaveBeenCalled()
      expect(screen.getAllByText('Option A').length).toBeGreaterThan(0)
   })

   it('renders the admin inset sub-trigger and radio item', async () => {
      render(
         <AdminDropdownMenu open>
            <AdminDropdownMenuTrigger>open</AdminDropdownMenuTrigger>
            <AdminDropdownMenuContent>
               <AdminDropdownMenuSub open>
                  <AdminDropdownMenuSubTrigger inset>More</AdminDropdownMenuSubTrigger>
                  <AdminDropdownMenuSubContent>
                     <p>nested</p>
                  </AdminDropdownMenuSubContent>
               </AdminDropdownMenuSub>
               <AdminDropdownMenuRadioGroup value="a">
                  <AdminDropdownMenuRadioItem value="a">Admin A</AdminDropdownMenuRadioItem>
               </AdminDropdownMenuRadioGroup>
               <AdminDropdownMenuCheckboxItem checked>
                  Admin check
               </AdminDropdownMenuCheckboxItem>
            </AdminDropdownMenuContent>
         </AdminDropdownMenu>
      )

      const findAllByTextResult = await screen.findAllByText('More')
      expect(findAllByTextResult.length).toBeGreaterThan(0)
      expect(screen.getAllByText('Admin A').length).toBeGreaterThan(0)
   })
})

describe('select separator', () => {
   it('renders the separator node', () => {
      const { container } = render(<SelectSeparator />)

      expect(container.firstChild).toBeInTheDocument()
   })

   it('renders the admin separator node', () => {
      const { container } = render(<AdminSelectSeparatorTrigger orientation="horizontal" />)

      expect(container.querySelector('[data-orientation]')).toBeInTheDocument()
   })
})

describe('admin command dialog chrome', () => {
   it('renders inside a portal when open', async () => {
      render(
         <AdminCommandDialog open>
            <AdminCommandInput placeholder="Admin search" />
            <AdminCommandList>
               <AdminCommandItem>Palette entry</AdminCommandItem>
            </AdminCommandList>
         </AdminCommandDialog>
      )

      expect(await screen.findByText('Palette entry')).toBeInTheDocument()
   })
})

describe('tweet media grid', () => {
   const baseTweet = {
      id: '1',
      text: 'hello world',
      created_at: '2024-01-01T00:00:00.000Z',
      author: {
         username: 'ada',
         name: 'Ada',
         profile_image_url: 'https://cdn/p.png',
         verified: false,
      },
      public_metrics: { reply_count: 1, like_count: 2, retweet_count: 3 },
      media: [
         { media_key: 'm1', type: 'photo', url: 'https://cdn/a.png', height: 100, width: 100 },
         { media_key: 'm2', type: 'photo', url: 'https://cdn/b.png', height: 100, width: 100 },
      ],
   }

   it('uses the two-column grid for multiple images', async () => {
      const { default: Tweet } = await import('@/components/native/mdx/Tweet')
      const AnyTweet = Tweet as unknown as (props: object) => React.ReactElement

      const { container } = render(<AnyTweet {...baseTweet} />)

      expect(container.querySelector('.grid-cols-2')).toBeInTheDocument()
   })

   it('uses the single-column grid for one image', async () => {
      const { default: Tweet } = await import('@/components/native/mdx/Tweet')
      const AnyTweet = Tweet as unknown as (props: object) => React.ReactElement

      const { container } = render(
         <AnyTweet {...{ ...baseTweet, media: [baseTweet.media[0]] }} />
      )

      expect(container.querySelector('.grid-cols-1')).toBeInTheDocument()
   })
})

describe('toast open-change callback', () => {
   it('ignores an open transition', async () => {
      const { result } = renderHook(() => useToast())

      act(() => {
         toast({ title: 'stays' })
      })

      await waitFor(() => { expect(result.current.toasts.length).toBe(1); })

      const entry = result.current.toasts[0]

      /* Radix reports both transitions; only the closing one dismisses. */
      act(() => {
         entry.onOpenChange?.(true)
      })

      expect(result.current.toasts[0].open).toBe(true)
   })
})

describe('admin modal dismissal', () => {
   it('calls onClose when the dialog asks to close', async () => {
      const onClose = vi.fn()

      render(
         <Modal title="Delete?" description="Gone." isOpen onClose={onClose}>
            <p>body</p>
         </Modal>
      )

      /* The dialog ships its own close control, which goes through
         onOpenChange(false) and therefore the modal's own wrapper. */
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))

      await waitFor(() => { expect(onClose).toHaveBeenCalled(); })
   })
})

describe('storefront modal dismissal', () => {
   it('calls onClose when the dialog asks to close', async () => {
      const onClose = vi.fn()

      render(
         <StoreAlertModal isOpen onClose={onClose} onConfirm={vi.fn()} loading={false} />
      )

      fireEvent.click(await screen.findByRole('button', { name: 'Close' }))

      await waitFor(() => { expect(onClose).toHaveBeenCalled(); })
   })
})
