import prisma from '@/lib/prisma'
import { decryptSettingSecret, encryptSettingSecret } from '@/lib/settings-crypto'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const updateSchema = z.object({
   taxEnabled: z.boolean(),
   taxRate: z.number().finite().min(0).max(1),
   taxLabel: z.string().trim().min(1).max(80),
   currency: z.literal('IRT'),
   gatewayActive: z.boolean(),
   sandbox: z.boolean(),
   merchantKey: z.string().trim().max(500).optional(),
})

function isAdminRequest(req: Request) {
   // src/proxy.ts verifies the signed JWT and admin role before forwarding this header.
   return Boolean(req.headers.get('X-USER-ID'))
}

function gatewaySettings(value: unknown): { sandbox?: boolean } {
   if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
   return value as { sandbox?: boolean }
}

export async function GET(req: Request) {
   if (!isAdminRequest(req)) {
      return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   }

   try {
      const [store, gateway] = await Promise.all([
         prisma.storeSetting.upsert({
            where: { id: 'default' },
            create: { id: 'default' },
            update: {},
         }),
         prisma.paymentProvider.findFirst({
            where: { OR: [{ code: 'tabapay' }, { title: { equals: 'Tabapay', mode: 'insensitive' } }] },
            select: { title: true, isActive: true, settings: true, credentialsEncrypted: true },
         }),
      ])

      let credentialsConfigured = false
      if (gateway?.credentialsEncrypted) {
         try {
            decryptSettingSecret(gateway.credentialsEncrypted)
            credentialsConfigured = true
         } catch {
            credentialsConfigured = false
         }
      }

      return NextResponse.json({
         taxEnabled: store.taxEnabled,
         taxRate: store.taxRate * 100,
         taxLabel: store.taxLabel,
         currency: store.currency,
         gateway: {
            code: 'tabapay',
            title: gateway?.title ?? 'TabaPay',
            isActive: Boolean(gateway?.isActive && credentialsConfigured),
            sandbox: gatewaySettings(gateway?.settings).sandbox !== false,
            credentialsConfigured,
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
      const existing = await prisma.paymentProvider.findFirst({
         where: { OR: [{ code: 'tabapay' }, { title: { equals: 'Tabapay', mode: 'insensitive' } }] },
         select: { id: true, isActive: true, settings: true, credentialsEncrypted: true },
      })

      const currentSettings = gatewaySettings(existing?.settings)
      const gatewayChanged = Boolean(input.merchantKey) ||
         input.sandbox !== (currentSettings.sandbox !== false) ||
         input.gatewayActive !== Boolean(existing?.isActive)

      if (existing && gatewayChanged) {
         const processingPayments = await prisma.payment.count({
            where: { providerId: existing.id, status: 'Processing' },
         })
         if (processingPayments > 0) {
            return NextResponse.json(
               { message: 'GATEWAY_HAS_PENDING_TRANSACTIONS' },
               { status: 409 }
            )
         }
      }

      const credentialsEncrypted = input.merchantKey
         ? encryptSettingSecret(input.merchantKey)
         : existing?.credentialsEncrypted ?? null

      let credentialsReadable = false
      if (credentialsEncrypted) {
         try {
            decryptSettingSecret(credentialsEncrypted)
            credentialsReadable = true
         } catch {
            credentialsReadable = false
         }
      }

      if (input.gatewayActive && !credentialsReadable) {
         return NextResponse.json(
            { message: 'GATEWAY_CREDENTIALS_REQUIRED_OR_ENCRYPTION_KEY_INVALID' },
            { status: 400 }
         )
      }

      const [, gateway] = await prisma.$transaction(async (tx) => {
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

         const provider = existing
            ? await tx.paymentProvider.update({
               where: { id: existing.id },
               data: {
                  code: 'tabapay',
                  isActive: input.gatewayActive,
                  settings: { sandbox: input.sandbox },
                  credentialsEncrypted,
                  ...(input.merchantKey ? { credentialsUpdatedAt: new Date() } : {}),
               },
            })
            : await tx.paymentProvider.create({
               data: {
                  code: 'tabapay',
                  title: 'TabaPay',
                  description: 'درگاه پرداخت تاباپی',
                  websiteUrl: 'https://tabapay.ir',
                  isActive: input.gatewayActive,
                  settings: { sandbox: input.sandbox },
                  credentialsEncrypted,
                  ...(input.merchantKey ? { credentialsUpdatedAt: new Date() } : {}),
               },
            })

         return [store, provider] as const
      })

      return NextResponse.json({
         saved: true,
         gatewayActive: gateway.isActive,
         credentialsConfigured: Boolean(gateway.credentialsEncrypted),
      })
   } catch (error) {
      if (error instanceof ZodError) {
         return NextResponse.json({ message: 'INVALID_SETTINGS', issues: error.issues }, { status: 400 })
      }
      if (error instanceof Error && error.message.includes('APP_SETTINGS_ENCRYPTION_KEY')) {
         return NextResponse.json({ message: 'APP_SETTINGS_ENCRYPTION_KEY_REQUIRED' }, { status: 503 })
      }
      console.error('[ADMIN_SETTINGS_PUT]', error)
      return NextResponse.json({ message: 'SETTINGS_SAVE_FAILED' }, { status: 500 })
   }
}
