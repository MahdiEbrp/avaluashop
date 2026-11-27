import { adminId } from '@/lib/require-admin'
import prisma from '@/lib/prisma'
import { decryptSettingSecret, encryptSettingSecret } from '@/lib/settings-crypto'
import { TABAPAY_PROVIDER_CODE, providerSettings } from '@/lib/payments/tabapay'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

/* An abandoned checkout leaves its payment row in `Processing` forever, so the
   guard only looks at recent rows: without a window, one abandoned payment
   would freeze the gateway settings for good. */
const PENDING_PAYMENT_WINDOW_MS = 2 * 60 * 60 * 1000

const PROVIDER_SELECT = {
   id: true,
   code: true,
   title: true,
   isActive: true,
   settings: true,
   credentialsEncrypted: true,
} as const

const updateSchema = z.object({
   taxEnabled: z.boolean(),
   taxRate: z.number().min(0).max(1),
   taxLabel: z.string().trim().min(1).max(80),
   currency: z.literal('IRT'),
   gatewayActive: z.boolean(),
   sandbox: z.boolean(),
   merchantKey: z.string().trim().max(500).optional(),
})

/* Thrown inside the write transaction so the pending-payments guard and the
   update cannot interleave. */
class PendingPaymentsError extends Error {}

function isAdminRequest(req: Request) {
   // src/proxy.ts verifies the signed JWT and the admin role, and overwrites
   // any client-supplied X-USER-ID before forwarding this header.
   return Boolean(adminId(req))
}

function credentialsReadable(blob: string | null | undefined) {
   if (!blob) return false

   try {
      decryptSettingSecret(blob)
      return true
   } catch {
      return false
   }
}

/**
 * Resolve the gateway row by its stable `code`. Rows written before `code`
 * existed carry only a display title, so those are adopted rather than
 * duplicated — two rows for one gateway used to make config resolution
 * non-deterministic.
 */
async function resolveProvider() {
   const byCode = await prisma.paymentProvider.findUnique({
      where: { code: TABAPAY_PROVIDER_CODE },
      select: PROVIDER_SELECT,
   })

   if (byCode) return byCode

   return prisma.paymentProvider.findFirst({
      where: { title: { in: ['TabaPay', 'Tabapay'] } },
      select: PROVIDER_SELECT,
   })
}

export async function GET(req: Request) {
   if (!isAdminRequest(req)) {
      return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   }

   try {
      const [store, provider] = await Promise.all([
         prisma.storeSetting.upsert({
            where: { id: 'default' },
            create: { id: 'default' },
            update: {},
         }),
         resolveProvider(),
      ])

      return NextResponse.json({
         taxEnabled: store.taxEnabled,
         taxRate: store.taxRate * 100,
         taxLabel: store.taxLabel,
         currency: store.currency,
         gateway: {
            code: TABAPAY_PROVIDER_CODE,
            title: provider?.title ?? 'TabaPay',
            /* Reported as stored, not masked by key availability: masking it
               made simply saving the page silently disable the gateway. */
            isActive: provider?.isActive ?? false,
            sandbox: providerSettings(provider?.settings).sandbox !== false,
            credentialsConfigured: credentialsReadable(provider?.credentialsEncrypted),
         },
      })
   } catch (error) {
      console.error('[ADMIN_SETTINGS_GET]', error)
      return NextResponse.json({ message: 'SETTINGS_READ_FAILED' }, { status: 500 })
   }
}

export async function PUT(req: Request) {
   if (!isAdminRequest(req)) {
      return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   }

   try {
      const input = updateSchema.parse(await req.json())
      const existing = await resolveProvider()
      const current = providerSettings(existing?.settings)

      const gatewayChanged =
         Boolean(input.merchantKey) ||
         input.sandbox !== (current.sandbox !== false) ||
         input.gatewayActive !== (existing?.isActive ?? false)

      const credentialsEncrypted = input.merchantKey
         ? encryptSettingSecret(input.merchantKey)
         : existing?.credentialsEncrypted ?? null

      if (input.gatewayActive && !credentialsReadable(credentialsEncrypted)) {
         return NextResponse.json(
            { message: 'GATEWAY_CREDENTIALS_REQUIRED_OR_ENCRYPTION_KEY_INVALID' },
            { status: 400 }
         )
      }

      /* Preserve unknown keys: `settings` is free-form JSON shared with other
         provider configuration, so it is merged rather than replaced. */
      const settings = { ...current, sandbox: input.sandbox }

      const [, provider] = await prisma.$transaction(async (tx) => {
         if (existing && gatewayChanged) {
            const pending = await tx.payment.count({
               where: {
                  providerId: existing.id,
                  status: 'Processing',
                  createdAt: { gte: new Date(Date.now() - PENDING_PAYMENT_WINDOW_MS) },
               },
            })

            if (pending > 0) throw new PendingPaymentsError()
         }

         const store = await tx.storeSetting.upsert({
            where: { id: 'default' },
            create: {
               id: 'default',
               taxEnabled: input.taxEnabled,
               taxRate: input.taxRate,
               taxLabel: input.taxLabel,
               currency: input.currency,
            },
            update: {
               taxEnabled: input.taxEnabled,
               taxRate: input.taxRate,
               taxLabel: input.taxLabel,
               currency: input.currency,
            },
         })

         const data = {
            code: TABAPAY_PROVIDER_CODE,
            isActive: input.gatewayActive,
            settings,
            credentialsEncrypted,
            ...(input.merchantKey ? { credentialsUpdatedAt: new Date() } : {}),
         }

         const saved = existing
            ? await tx.paymentProvider.update({ where: { id: existing.id }, data })
            : await tx.paymentProvider.create({
               data: {
                  ...data,
                  title: 'TabaPay',
                  description: 'درگاه پرداخت تاباپی',
                  websiteUrl: 'https://tabapay.ir',
               },
            })

         return [store, saved] as const
      })

      return NextResponse.json({
         saved: true,
         gatewayActive: provider.isActive,
         credentialsConfigured: Boolean(provider.credentialsEncrypted),
      })
   } catch (error) {
      /* A malformed body is a client error, not a server fault. */
      if (error instanceof SyntaxError) {
         return NextResponse.json({ message: 'INVALID_SETTINGS' }, { status: 400 })
      }
      if (error instanceof ZodError) {
         return NextResponse.json({ message: 'INVALID_SETTINGS', issues: error.issues }, { status: 400 })
      }
      if (error instanceof PendingPaymentsError) {
         return NextResponse.json({ message: 'GATEWAY_HAS_PENDING_TRANSACTIONS' }, { status: 409 })
      }
      if (error instanceof Error && error.message.includes('APP_SETTINGS_ENCRYPTION_KEY')) {
         return NextResponse.json({ message: 'APP_SETTINGS_ENCRYPTION_KEY_REQUIRED' }, { status: 503 })
      }
      console.error('[ADMIN_SETTINGS_PUT]', error)
      return NextResponse.json({ message: 'SETTINGS_SAVE_FAILED' }, { status: 500 })
   }
}
