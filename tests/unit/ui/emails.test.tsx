import { renderToString } from 'react-dom/server'

import { VercelInviteUserEmail as AdminOrderEmail } from '@/emails/order_notification_owner.admin'
import { VercelInviteUserEmail as OrderEmail } from '@/emails/order_notification_owner'

/* @react-email's <Tailwind> resolves its preset through a promise, which makes
   the whole tree suspend; the email's own markup is what these tests cover. */
vi.mock('@react-email/components', async (importOriginal) => {
   const actual = await importOriginal<typeof import('@react-email/components')>()

   return {
      ...actual,
      Tailwind: ({ children }: { children: React.ReactNode }) => <>{children}</>,
   }
})

const ENV_KEYS = ['VERCEL_URL', 'NEXT_PUBLIC_URL'] as const

const original: Record<string, string | undefined> = {}

beforeEach(() => {
   for (const key of ENV_KEYS) original[key] = process.env[key]
   process.env.NEXT_PUBLIC_URL = 'https://shop.example'
   delete process.env.VERCEL_URL
})

afterEach(() => {
   for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
   }
})

describe('order notification owner email', () => {
   it('renders the order preview and link', () => {
      const html = renderToString(
         <OrderEmail orderNum="42" payable="129.99" id="order-1" />
      )

      expect(html).toContain('42')
      expect(html).toContain('129.99')
      expect(html).toContain('/orders/order-1')
   })

   it('defaults every prop', () => {
      const html = renderToString(<OrderEmail />)

      expect(html).toContain('$<!-- -->0')
   })
})

describe('admin order notification email', () => {
   it('renders the order preview and link', () => {
      const html = renderToString(
         <AdminOrderEmail orderNum="7" payable="10.00" id="order-7" />
      )

      expect(html).toContain('7')
      expect(html).toContain('10.00')
      expect(html).toContain('/orders/order-7')
   })

   it('defaults every prop when nothing is supplied', () => {
      const html = renderToString(<AdminOrderEmail />)

      expect(html).toContain('My Project')
   })
})

describe('email preview text', () => {
   it('describes the order number and payable amount', () => {
      const html = renderToString(<OrderEmail orderNum="3" payable="50" id="x" />)

      expect(html).toMatch(/Order #3/)
   })
})

describe('email assets on Vercel', () => {
   /* `baseUrl` is read once at module load, so the module has to be re-imported
      after the environment changes. */
   beforeEach(() => {
      vi.resetModules()
      process.env.VERCEL_URL = 'shop-abc.vercel.app'
   })

   afterEach(() => {
      delete process.env.VERCEL_URL
      vi.resetModules()
   })

   it('prefixes the logo with the deployment host', async () => {
      const { VercelInviteUserEmail } = await import('@/emails/order_notification_owner')

      const html = renderToString(<VercelInviteUserEmail orderNum="1" payable="2" id="x" />)

      expect(html).toContain('https://shop-abc.vercel.app/static/vercel-logo.png')
   })

   it('does the same for the admin copy', async () => {
      const { VercelInviteUserEmail } = await import('@/emails/order_notification_owner.admin')

      const html = renderToString(<VercelInviteUserEmail orderNum="1" payable="2" id="x" />)

      expect(html).toContain('https://shop-abc.vercel.app/static/vercel-logo.png')
   })
})
