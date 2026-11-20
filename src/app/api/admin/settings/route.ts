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

function requireAdmin(req: Request) {
   return req.headers.get('X-USER-ID')
}

export async function GET(req: Request) {
   if (!requireAdmin(req)) return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })

   try {
      const [store, gateway] = await Promise.all([
         prisma.storeSetting.upsert({
            where: { id: 'default' },
            create: { id: 'default' },
            update: {},
         }),
         prisma.paymentProvider.findFirst({ where: { OR: [{ code: 'tabapay' }, { title: 'Tabapay' }] } }),
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

      const gatewaySettings =
         gateway?.settings && typeof gateway.settings === 'object'
            ? gateway.settings as { sandbox?: boolean }
            : {}

      return NextResponse.json({
         taxEnabled: store.taxEnabled,
         taxRate: store.taxRate * 100,
         taxLabel: store.taxLabel,
         currency: store.currency,
         gateway: {
            code: 'tabapay',
            title: gateway?.title ?? 'TabaPay',
            isActive: gateway?.isActive ?? false,
            sandbox: gatewaySettings.sandbox !== false,
            credentialsConfigured,
         },
      })
   } catch (error) {
      console.error('[ADMIN_SETTINGS_GET]', error)
      return NextResponse.json({ message: 'SETTINGS_READ_FAILED' }, { status: 500 })
   }
}

export async function PUT(req: Request) {
   if (!requireAdmin(req)) return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })

   try {
      const input = updateSchema.parse(await req.json())
      const existingGateway = await prisma.paymentProvider.findFirst({
         where: { OR: [{ code: 'tabapay' }, { title: 'Tabapay' }] },
         select: { id: true, credentialsEncrypted: true, isActive: true, settings: true },
      })

      if (existingGateway) {
         const activePayments = await prisma.payment.count({
            where: { providerId: existingGateway.id, status: 'Processing' },
         })
         const currentGatewaySettings =
            existingGateway.settings && typeof existingGateway.settings === 'object'
               ? existingGateway.settings as { sandbox?: boolean }
               : {}
         const gatewayConfigurationChanged =
            Boolean(input.merchantKey) ||
            input.sandbox !== (currentGatewaySettings.sandbox !== false) ||
            input.gatewayActive !== existingGateway.isActive

         if (activePayments > 0 && gatewayConfigurationChanged) {
            return NextResponse.json(
               { message: 'GATEWAY_HAS_PENDING_TRANSACTIONS' },
               { status: 409 }
            )
         }
      }

      const credentialsEncrypted = input.merchantKey
         ? encryptSettingSecret(input.merchantKey)
         : existingGateway?.credentialsEncrypted ?? null

      if (input.gatewayActive && !credentialsEncrypted) {
         return NextResponse.json({ message: 'GATEWAY_CREDENTIALS_REQUIRED' }, { status: 400 })
      }

      const [, gateway] = await prisma.$transaction([
         prisma.storeSetting.upsert({
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
         }),
         prisma.paymentProvider.upsert({
            where: { title: 'Tabapay' },
            create: {
               code: 'tabapay',
               title: 'Tabapay',
               description: 'درگاه پرداخت تاباپی',
               websiteUrl: 'https://tabapay.ir',
               isActive: input.gatewayActive,
               settings: { sandbox: input.sandbox },
               credentialsEncrypted,
            },
            update: {
               code: 'tabapay',
               isActive: input.gatewayActive,
               settings: { sandbox: input.sandbox },
               credentialsEncrypted,
            },
         }),
      ])

      return NextResponse.json({
         saved: true,
         gatewayActive: gateway.isActive,
         credentialsConfigured: Boolean(gateway.credentialsEncrypted),
      })
   } catch (error) {
      if (error instanceof ZodError) {
         return NextResponse.json({ message: 'INVALID_SETTINGS', issues: error.issues }, { status: 400 })
      }
      console.error('[ADMIN_SETTINGS_PUT]', error)
      return NextResponse.json({ message: 'SETTINGS_SAVE_FAILED' }, { status: 500 })
   }
}
