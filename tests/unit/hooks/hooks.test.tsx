import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { useTheme } from 'next-themes'

import { useActiveStore } from '@/hooks/use-active-store'
import { useCategoryModal } from '@/hooks/use-category-modal'
import { useIsClient } from '@/hooks/use-is-client'
import { publishLocalCart, useLocalCart } from '@/hooks/use-local-cart'
import { useOrigin } from '@/hooks/use-origin'
import { useProductModal } from '@/hooks/use-product-modal'
import { useSyncedState } from '@/hooks/use-synced-state'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { ModalProvider } from '@/providers/modal-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { setCookie } from '../support/cookies'

describe('zustand stores', () => {
   beforeEach(() => {
      useActiveStore.setState({ id: undefined })
      useCategoryModal.setState({ isOpen: false, isEdit: false, editId: undefined })
      useProductModal.setState({ isOpen: false, isEdit: false, editId: undefined })
   })

   it('useActiveStore tracks the active row id', () => {
      useActiveStore.getState().set('row-1')
      expect(useActiveStore.getState().id).toBe('row-1')

      useActiveStore.getState().reset()
      expect(useActiveStore.getState().id).toBeUndefined()
   })

   it('useCategoryModal opens, edits and closes', () => {
      useCategoryModal.getState().onOpen()
      expect(useCategoryModal.getState()).toMatchObject({ isOpen: true, isEdit: false })

      useCategoryModal.getState().onEdit('cat-9')
      expect(useCategoryModal.getState()).toMatchObject({
         isOpen: true,
         isEdit: true,
         editId: 'cat-9',
      })

      useCategoryModal.getState().onClose()
      expect(useCategoryModal.getState()).toMatchObject({
         isOpen: false,
         isEdit: false,
         editId: undefined,
      })
   })

   it('useProductModal opens, edits and closes', () => {
      useProductModal.getState().onOpen()
      expect(useProductModal.getState().isOpen).toBe(true)

      useProductModal.getState().onEdit('prod-3')
      expect(useProductModal.getState()).toMatchObject({ isEdit: true, editId: 'prod-3' })

      useProductModal.getState().onClose()
      expect(useProductModal.getState()).toMatchObject({ isOpen: false, editId: undefined })
   })
})

describe('useIsClient', () => {
   it('is true after hydration', () => {
      const { result } = renderHook(() => useIsClient())
      expect(result.current).toBe(true)
   })
})

describe('useOrigin', () => {
   it('reports the browser origin', () => {
      const { result } = renderHook(() => useOrigin())
      expect(result.current).toBe(globalThis.location.origin)
   })
})

describe('useAuthenticated', () => {
   it('is false without the cookie', () => {
      setCookie('logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT')
      const { result } = renderHook(() => useAuthenticated())

      expect(result.current.authenticated).toBe(false)
   })

   it('is true with logged-in=true', () => {
      setCookie('logged-in=true')
      const { result } = renderHook(() => useAuthenticated())

      expect(result.current.authenticated).toBe(true)
      setCookie('logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT')
   })

   it('ignores unrelated cookies', () => {
      setCookie('other=true')
      setCookie('logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT')

      const { result } = renderHook(() => useAuthenticated())

      expect(result.current.authenticated).toBe(false)
   })
})

describe('useLocalCart', () => {
   it('starts empty', () => {
      const { result } = renderHook(() => useLocalCart())

      expect(result.current).toEqual({ items: [] })
   })

   it('reads what publishLocalCart wrote', () => {
      const { result } = renderHook(() => useLocalCart())

      act(() => { publishLocalCart({ items: [{ productId: 'p1', count: 2 }] }); })

      expect(result.current).toEqual({ items: [{ productId: 'p1', count: 2 }] })
      expect(JSON.parse(localStorage.getItem('Cart'))).toEqual({
         items: [{ productId: 'p1', count: 2 }],
      })
   })

   it('reacts to a storage event from another tab', () => {
      const { result } = renderHook(() => useLocalCart())

      act(() => {
         localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p9', count: 1 }] }))
         globalThis.dispatchEvent(new Event('storage'))
      })

      expect(result.current).toEqual({ items: [{ productId: 'p9', count: 1 }] })
   })

   it('stays referentially stable between renders', () => {
      const { result, rerender } = renderHook(() => useLocalCart())
      const first = result.current

      rerender()

      expect(result.current).toBe(first)
   })

   it('falls back to an empty cart when the stored value has no items array', () => {
      const { result } = renderHook(() => useLocalCart())

      act(() => {
         localStorage.setItem('Cart', JSON.stringify({ nope: true }))
         globalThis.dispatchEvent(new Event('storage'))
      })

      expect(result.current).toEqual({ items: [] })
   })

   it('unsubscribes on unmount', () => {
      const remove = vi.spyOn(globalThis, 'removeEventListener')
      const { unmount } = renderHook(() => useLocalCart())

      unmount()

      expect(remove).toHaveBeenCalledWith('avaluashop:local-cart', expect.any(Function))
      expect(remove).toHaveBeenCalledWith('storage', expect.any(Function))
   })
})

describe('useSyncedState', () => {
   it('keeps local edits while the source is unchanged', () => {
      const { result, rerender } = renderHook(({ source }) => useSyncedState(source), {
         initialProps: { source: 'first' },
      })

      act(() => { result.current[1]('edited'); })
      expect(result.current[0]).toBe('edited')

      rerender({ source: 'first' })
      expect(result.current[0]).toBe('edited')
   })

   it('resets to the new source when the identity changes', () => {
      const { result, rerender } = renderHook(({ source }) => useSyncedState(source), {
         initialProps: { source: 'first' },
      })

      rerender({ source: 'second' })

      expect(result.current[0]).toBe('second')
   })
})

describe('providers', () => {
   it('ModalProvider renders nothing until mounted', () => {
      const { container } = render(<ModalProvider />)
      expect(container).toBeEmptyDOMElement()
   })

   it('ToastProvider renders the hot-toast region', async () => {
      const { container } = render(<ToastProvider />)

      await waitFor(() => { expect(container.firstChild).not.toBeNull(); })
   })

   it('ThemeProvider hands next-themes down to consumers', () => {
      function Consumer() {
         const { theme } = useTheme()
         return <span>theme:{theme}</span>
      }

      render(
         <ThemeProvider attribute="class" defaultTheme="dark">
            <Consumer />
         </ThemeProvider>
      )

      expect(screen.getByText('theme:dark')).toBeInTheDocument()
   })
})
