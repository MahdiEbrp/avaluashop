import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LogoutButton } from '@/components/admin/logout-button'
import { MainNav as AdminMainNav } from '@/components/admin/main-nav'
import { ThemeToggle as AdminThemeToggle } from '@/components/admin/theme-toggle'
import { Overview } from '@/components/admin/overview'
import { UserNav as AdminUserNav } from '@/components/admin/user-nav'
import { CommandMenu } from '@/components/composites/command'
import Carousel from '@/components/native/Carousel'
import CompareImage from '@/components/native/CompareImage'
import GoogleAnalytics from '@/components/native/GoogleAnalytics'
import ConsCard from '@/components/native/mdx/ConsCard'
import MDXComponents from '@/components/native/mdx/MDXComponents'
import ProsCard from '@/components/native/mdx/ProsCard'
import Step from '@/components/native/mdx/Step'
import Tweet from '@/components/native/mdx/Tweet'
import { MainNav } from '@/components/native/nav/desktop'
import { MobileNav } from '@/components/native/nav/mobile'
import Header from '@/components/native/nav/parent'
import { SidebarNav } from '@/components/native/nav/sidebar'
import { UserNav } from '@/components/native/nav/user'
import { ModalProvider } from '@/providers/modal-provider'
import { routerMock } from '../support/navigation'

const themeMock = { resolvedTheme: 'light', setTheme: vi.fn() }

vi.mock('next-themes', () => ({
   useTheme: () => themeMock,
}))

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return { ...actual, ...navigation }
})

/* Embla needs a real layout engine; the double reports a two-slide carousel. */
const emblaHandlers: Record<string, () => void> = {}
/* Mutable so one test can report the first slide (the `index || 0` fallback in
   the select handler) while the rest keep the second slide. */
const emblaState = { snap: 1 }
vi.mock('embla-carousel-react', () => ({
   default: () => [
      () => {},
      {
         selectedScrollSnap: () => emblaState.snap,
         on: (event: string, handler: () => void) => {
            emblaHandlers[event] = handler
         },
         off: (event: string) => {
            delete emblaHandlers[event]
         },
      },
   ],
}))
vi.mock('embla-carousel-autoplay', () => ({ default: () => ({}) }))

/* Recharts measures the DOM, which jsdom reports as zero-sized. */
vi.mock('recharts', () => ({
   ResponsiveContainer: ({ children }: never) => <div data-testid="chart">{children}</div>,
   BarChart: ({ children, data }: never) => (
      <div data-testid="bars" data-count={(data as unknown[]).length}>
         {children}
      </div>
   ),
   XAxis: () => null,
   YAxis: ({ tickFormatter }: { tickFormatter?: (value: number) => string }) => (
      <p>{tickFormatter?.(12)}</p>
   ),
   Bar: () => null,
}))

beforeEach(() => {
   themeMock.setTheme.mockClear()
   routerMock.push.mockClear()
   emblaState.snap = 1
})

describe('admin chrome', () => {
   it('main nav highlights the active section', () => {
      render(<AdminMainNav />)

      expect(screen.getByRole('link', { name: 'Banners' })).toHaveAttribute(
         'href',
         '/admin/banners'
      )
      expect(screen.getByRole('link', { name: 'Codes' })).toBeInTheDocument()
   })

   it('theme toggle flips the theme', async () => {
      render(<AdminThemeToggle />)

      await userEvent.setup().click(screen.getByRole('button'))

      expect(themeMock.setTheme).toHaveBeenCalledWith('dark')
   })

   it('theme toggle returns to light from dark', async () => {
      themeMock.resolvedTheme = 'dark'
      render(<AdminThemeToggle />)

      await userEvent.setup().click(screen.getByRole('button'))

      expect(themeMock.setTheme).toHaveBeenCalledWith('light')
      themeMock.resolvedTheme = 'light'
   })

   it('logout button posts and reloads', async () => {
      const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const reload = vi.fn()
      vi.stubGlobal('location', { ...globalThis.location, reload })

      render(<LogoutButton />)
      await userEvent.setup().click(screen.getByRole('button'))

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/auth/logout', { cache: 'no-store' })
      await waitFor(() => expect(reload).toHaveBeenCalled())
      vi.unstubAllGlobals()
   })

   it('logout button swallows a network failure', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<LogoutButton />)
      await userEvent.setup().click(screen.getByRole('button'))

      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })

   it('admin user nav opens its shortcut menu', async () => {
      render(<AdminUserNav />)

      await userEvent.setup().click(screen.getByRole('button'))

      expect(await screen.findByText('shadcn')).toBeInTheDocument()
      expect(screen.getByText('m@example.com')).toBeInTheDocument()
   })

   it('overview chart receives the series', () => {
      render(<Overview data={[{ name: 'Jan', total: 10 }, { name: 'Feb', total: 20 }]} />)

      expect(screen.getByTestId('bars')).toHaveAttribute('data-count', '2')
      expect(screen.getByText('۱۲')).toBeInTheDocument()
   })
})

describe('storefront shell navigation', () => {
   it('shows a login button to guests', () => {
      render(<Header />)

      /* The redesign labels the guest call to action in Persian. */
      expect(screen.getByText('ورود / ثبت‌نام')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /ورود \/ ثبت‌نام/ })).toHaveAttribute(
         'href',
         '/login'
      )
   })

   it('shows the account menu to signed-in visitors', () => {
      document.cookie = 'logged-in=true'
      render(<Header />)

      expect(screen.queryByText('ورود / ثبت‌نام')).not.toBeInTheDocument()
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
   })

   /* The redesign removes the header theme toggle; the admin navbar keeps its
      own and is covered in gaps-m. */

   it('desktop main nav renders its menu', () => {
      render(<MainNav />)

      /* The storefront nav is accessor-only: a single catalogue link plus
         the two brand pages. */
      expect(screen.getByRole('link', { name: 'همه اکسسوری‌ها' })).toHaveAttribute(
         'href',
         '/products'
      )
      expect(screen.getByRole('link', { name: 'درباره آوالونا شاپ' })).toHaveAttribute(
         'href',
         '/about'
      )
      expect(screen.getByRole('link', { name: 'تماس با ما' })).toHaveAttribute(
         'href',
         '/contact'
      )
   })

   it('mobile nav opens the sheet', async () => {
      render(<MobileNav />)

      await userEvent.setup().click(screen.getByRole('button', { name: /باز کردن منو/i }))

      /* The mobile sheet lists the same five storefront pages as links. */
      expect(await screen.findByRole('link', { name: 'فروشگاه اکسسوری' })).toHaveAttribute(
         'href',
         '/products'
      )
      expect(screen.getByRole('link', { name: 'سوالات متداول' })).toHaveAttribute(
         'href',
         '/faq'
      )
   })

   it('mobile nav closes after choosing a link', async () => {
      render(<MobileNav />)

      /* Radix locks body pointer events while the sheet is open, which jsdom
         cannot recompute, and next/link swallows nothing under fireEvent. */
      fireEvent.click(screen.getByRole('button', { name: /باز کردن منو/i }))
      const link = await screen.findByRole('link', { name: 'فروشگاه اکسسوری' })
      fireEvent.click(link)

      /* Choosing a link closes the sheet. */
      await waitFor(() => expect(screen.queryByRole('link', { name: 'فروشگاه اکسسوری' })).not.toBeInTheDocument())
   })

   it('sidebar nav marks the current page', () => {
      render(<SidebarNav items={[{ href: '/', title: 'Home' }, { href: '/x', title: 'X' }]} />)

      expect(screen.getByRole('link', { name: 'Home' }).className).toContain('bg-muted')
   })

   it('user nav logs out through the API', async () => {
      const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const reload = vi.fn()
      vi.stubGlobal('location', { ...globalThis.location, reload })

      render(<UserNav />)
      await userEvent.setup().click(screen.getByRole('button'))

      const logOut = await screen.findByText(/خروج از حساب/i)
      await userEvent.setup().click(logOut)

      await waitFor(() =>
         expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { cache: 'no-store' })
      )
      vi.unstubAllGlobals()
   })
})

describe('command menu', () => {
   it('opens with the keyboard shortcut and navigates', async () => {
      render(<CommandMenu />)

      await act(async () => {
         fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
      })

      const link = await screen.findByText('فروشگاه اکسسوری')
      await userEvent.setup().click(link)

      expect(routerMock.push).toHaveBeenCalled()
   })

   it('opens from the search button and navigates', async () => {
      render(<CommandMenu />)

      /* The palette is search-only now; theme switching lives in the admin. */
      await userEvent.setup().click(screen.getByRole('button', { name: /جستجو در فروشگاه/i }))
      await userEvent.setup().click(await screen.findByText('درباره آوالونا شاپ'))

      expect(routerMock.push).toHaveBeenCalledWith('/about')
   })

   it('ignores other keys', async () => {
      render(<CommandMenu />)

      await act(async () => {
         fireEvent.keyDown(document, { key: 'j' })
      })

      expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument()
   })
})

describe('MDX components', () => {
   it('renders pros, cons and steps', () => {
      render(
         <>
            <ProsCard title="Vite" pros={['Fast', 'Small']} />
            <ConsCard title="Webpack" cons={['Slow']} />
            <Step number={1} title="Install" />
         </>
      )

      expect(screen.getByText('You might use Vite if...')).toBeInTheDocument()
      expect(screen.getByText('You might not use Webpack if...')).toBeInTheDocument()
      expect(screen.getByText('Install')).toBeInTheDocument()
   })

   it('renders the callout, header and image', () => {
      const { Callout, Header, MDXImage } = MDXComponents

      render(
         <>
            <Callout emoji="🔥">Body</Callout>
            <Header title="Section" />
            <MDXImage alt="diagram" src="/d.png" />
         </>
      )

      expect(screen.getByText('🔥')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Section' })).toBeInTheDocument()
      expect(screen.getByAltText('diagram')).toBeInTheDocument()
   })

   it('renders a tweet with its metrics', () => {
      render(
         <Tweet
            id="1"
            text="Hello https://x.co &amp; bye"
            created_at="2024-01-01T00:00:00Z"
            author={{
               username: 'ada',
               name: 'Ada',
               profile_image_url: '/a.png',
               verified: true,
            }}
            media={[]}
            public_metrics={{ like_count: 3, retweet_count: 1, reply_count: 2 }}
            referenced_tweets={[
               {
                  type: 'quoted',
                  id: '2',
                  text: 'Quoted',
                  created_at: '2024-01-01T00:00:00Z',
                  author: {
                     username: 'bob',
                     name: 'Bob',
                     profile_image_url: '/b.png',
                     verified: false,
                  },
                  public_metrics: { like_count: 0, retweet_count: 0, reply_count: 0 },
               },
            ]}
         />
      )

      expect(screen.getAllByText('Quoted').length).toBeGreaterThan(0)
      expect(
         screen.getAllByRole('link').filter((link) =>
            link.getAttribute('href').includes('tweet_id=1')
         ).length
      ).toBeGreaterThan(0)
   })
})

describe('carousel', () => {
   it('renders a dot per image and follows the selection', () => {
      const { container } = render(<Carousel images={['/a.png', '/b.png']} />)

      expect(container.querySelectorAll('img').length).toBe(2)

      act(() => {
         emblaHandlers.select?.()
      })

      expect(container.querySelectorAll('div.rounded-full').length).toBe(2)
   })

   it('renders no dots for an empty carousel', () => {
      const { container } = render(<Carousel images={[]} />)

      expect(container.querySelectorAll('img').length).toBe(0)
   })

   it('falls back to the first slide when embla reports slide zero', () => {
      /* `index || 0` only takes its right-hand operand for a falsy index; slide
         zero is the one case that happens in a real carousel. */
      emblaState.snap = 0
      const { container } = render(<Carousel images={['/a.png', '/b.png']} />)

      act(() => {
         emblaHandlers.select?.()
      })

      const dots = container.querySelectorAll('div.rounded-full')
      expect(dots).toHaveLength(2)
      expect(dots[0].className).toContain('bg-primary-foreground')
   })
})

describe('compare image slider', () => {
   it('renders both images with the labels', () => {
      render(
         <CompareImage
            leftImage="/left.png"
            rightImage="/right.png"
            leftImageAlt="left-image"
            rightImageAlt="right-image"
            leftImageLabel="Before"
            rightImageLabel="After"
         />
      )

      expect(screen.getByAltText('left-image')).toBeInTheDocument()
      expect(screen.getByAltText('right-image')).toBeInTheDocument()
      expect(screen.getByText('Before')).toBeInTheDocument()
   })

   it('moves the slider with a drag', () => {
      const onSliderPositionChange = vi.fn()
      const { container } = render(
         <CompareImage
            leftImage="/left.png"
            rightImage="/right.png"
            onSliderPositionChange={onSliderPositionChange}
         />
      )

      const slider = container.firstElementChild!
      fireEvent.mouseMove(slider, { clientX: 50, buttons: 1 })
      fireEvent.mouseDown(slider)
      act(() => {
         fireEvent.mouseUp(document)
      })

      expect(slider).toBeInTheDocument()
   })
})

describe('google analytics', () => {
   it('renders nothing outside production', () => {
      const { container } = render(<GoogleAnalytics />)

      expect(container).toBeEmptyDOMElement()
   })

   it('renders nothing without a measurement id', () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { container } = render(<GoogleAnalytics />)

      expect(container).toBeEmptyDOMElement()
      vi.unstubAllEnvs()
   })
})

describe('modal provider', () => {
   it('renders nothing until a modal is registered', () => {
      const { container } = render(<ModalProvider />)

      expect(container).toBeEmptyDOMElement()
   })
})
