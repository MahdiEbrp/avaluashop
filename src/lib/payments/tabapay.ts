import prisma from '@/lib/prisma'
import { decryptSettingSecret } from '@/lib/settings-crypto'

/* The canonical identity of the gateway row. Title is unique too, but titles
   are display strings and drift ("TabaPay" vs "Tabapay"); `code` is the stable
   key every module must resolve the provider by. */
export const TABAPAY_PROVIDER_CODE = 'tabapay'

interface TabapayResponse {
   responseCode?: number
   status?: string
   message?: string
   token?: string
   url?: string
   amount?: number
   hashedCardNumber?: string
}

type ProviderSettings = Record<string, string | number | boolean>

/** `settings` is free-form JSON; only known keys may be read from it. */
export function providerSettings(value: unknown): ProviderSettings {
   if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

   return value as ProviderSettings
}

async function getConfig(requireActive = true) {
   const provider = await prisma.paymentProvider.findUnique({
      where: { code: TABAPAY_PROVIDER_CODE },
      select: { isActive: true, settings: true, credentialsEncrypted: true },
   })

   if (!provider) throw new Error('TABAPAY_NOT_CONFIGURED')
   if (requireActive && !provider.isActive) throw new Error('PAYMENT_PROVIDER_DISABLED')
   if (!provider.credentialsEncrypted) throw new Error('TABAPAY_NOT_CONFIGURED')

   const merchantKey = decryptSettingSecret(provider.credentialsEncrypted)
   const sandbox = providerSettings(provider.settings).sandbox !== false
   const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL
   if (!appUrl) throw new Error('APP_URL_NOT_CONFIGURED')

   const base = appUrl.replace(/\/$/, '')
   const api = 'https://api.tabapay.ir/v1'

   return {
      merchantKey,
      appUrl: base,
      createUrl: sandbox ? `${api}/sandbox/create` : `${api}/create`,
      verifyUrl: sandbox ? `${api}/sandbox/verify` : `${api}/verify`,
   }
}

export async function validateTabapayConfiguration() {
   return getConfig()
}

export function isTabapayAmountValid(amountRial: number) {
   return Number.isSafeInteger(amountRial) && amountRial >= 100_000 && amountRial <= 500_000_000
}

async function postForm(url: string, merchantKey: string, fields: Record<string, string>) {
   const form = new FormData()
   for (const [key, value] of Object.entries(fields)) form.set(key, value)

   const response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${merchantKey}` },
      body: form,
   })

   if (!response.ok) throw new Error('TABAPAY_HTTP_ERROR')

   return (await response.json()) as TabapayResponse
}

export async function createTabapayPayment(input: {
   amountRial: number
   orderNumber: number
   mobile?: string
}) {
   const config = await getConfig()
   if (!isTabapayAmountValid(input.amountRial)) {
      throw new Error('TABAPAY_AMOUNT_OUT_OF_RANGE')
   }

   const result = await postForm(config.createUrl, config.merchantKey, {
      amount: String(input.amountRial),
      callbackURL: `${config.appUrl}/api/payments/tabapay/callback`,
      description: `Avaluona Shop order #${input.orderNumber}`,
      additionalData: JSON.stringify({ orderNumber: input.orderNumber }),
      ...(input.mobile && /^09\d{9}$/.test(input.mobile) ? { mobile: input.mobile } : {}),
   })

   if (result.status === 'failed') {
      throw new Error(`TABAPAY_CREATE_REJECTED:${result.message || 'TABAPAY_CREATE_FAILED'}`)
   }
   if (result.status !== 'success' || result.responseCode !== 1 || !result.token || !result.url) {
      throw new Error('TABAPAY_CREATE_UNCONFIRMED')
   }

   const paymentUrl = new URL(result.url)
   if (paymentUrl.protocol !== 'https:' || paymentUrl.hostname !== 'api.tabapay.ir') {
      throw new Error('TABAPAY_INVALID_PAYMENT_URL')
   }

   return { token: result.token, paymentUrl: paymentUrl.toString() }
}

export async function verifyTabapayPayment(input: { token: string; amountRial: number }) {
   /* Existing in-flight payments stay verifiable after new ones are disabled:
      the callback still has to settle or release the reservation. */
   const config = await getConfig(false)
   const result = await postForm(config.verifyUrl, config.merchantKey, {
      token: input.token,
      amount: String(input.amountRial),
   })

   if (result.status === 'success' && result.responseCode === 1) {
      if (result.token !== input.token || result.amount !== input.amountRial) {
         throw new Error('TABAPAY_VERIFICATION_MISMATCH')
      }
      return true
   }

   /* Only a provider response explicitly marked "failed" is definitive.
      "error", missing fields, malformed JSON and transport failures are
      ambiguous and must not release a stock reservation. */
   if (result.status === 'failed' && typeof result.responseCode === 'number') {
      return false
   }

   throw new Error('TABAPAY_VERIFICATION_UNCONFIRMED')
}
