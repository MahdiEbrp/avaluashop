import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { routerMock } from '../support/navigation'

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return { ...actual, ...navigation }
})

/* `next/link` accepts a Url object as well as a string; this config is the
   only place the app feeds one to `MobileLink`. */
vi.mock('@/config/docs', async (importOriginal) => {
   const actual = await importOriginal<typeof import('@/config/docs')>()

   return {
      ...actual,
      docsConfig: {
         ...actual.docsConfig,
         mainNav: [
            { title: 'Docs', href: { pathname: '/docs' } },
            /* A Url object with only a query has no pathname; the fallback
               sends the visitor to the site root. */
            { title: 'Bare', href: { query: { page: '2' } } },
         ],
      },
   }
})

it('pushes the pathname of a Url-object href', async () => {
   const { MobileNav } = await import('@/components/native/nav/mobile')

   render(<MobileNav />)

   fireEvent.click(screen.getByRole('button', { name: /toggle menu/i }))
   fireEvent.click(await screen.findByRole('link', { name: 'Docs' }))

   await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/docs'))
})

it('falls back to the root for a Url-object href without a pathname', async () => {
   const { MobileNav } = await import('@/components/native/nav/mobile')

   render(<MobileNav />)

   fireEvent.click(screen.getByRole('button', { name: /toggle menu/i }))
   fireEvent.click(await screen.findByRole('link', { name: 'Bare' }))

   await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/'))
})
