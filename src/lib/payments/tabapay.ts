type TabapayResponse = {
   responseCode?: number
   status?: string
   token?: string
   url?: string
   amount?: number | string
   message?: string
   trackingCode?: number | string
   shaparakRefNumber?: string
   cardNumber?: string
   hashedCardNumber?: string
}

function getConfig() {
   const merchantKey = process.env.TABAPAY_MERCHANT_KEY
   if (!merchantKey) throw new Error('TABAPAY_NOT_CONFIGURED')

   const sandbox = process.env.TABAPAY_SANDBOX !== 'false'
   const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL
   if (!appUrl) throw new Error('APP_URL_NOT_CONFIGURED')

   const baseUrl = 'https://api.tabapay.ir/v1'
   return {
      merchantKey,
      createUrl: sandbox ? `${baseUrl}/sandbox/create` : `${baseUrl}/create`,
      verifyUrl: sandbox ? `${baseUrl}/sandbox/verify` : `${baseUrl}/verify`,
      appUrl: appUrl.replace(/\/$/, ''),
   }
}

export function validateTabapayConfiguration() {
   return getConfig()
}

export function isTabapayAmountValid(amountRial: number) {
   return Number.isSafeInteger(amountRial) && amountRial >= 100_000 && amountRial <= 500_000_000
}

async function postForm(url: string, fields: Record<string, string>) {
   const { merchantKey } = getConfig()
   const form = new FormData()
   for (const [key, value] of Object.entries(fields)) form.set(key, value)

   const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${merchantKey}` },
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
   })
   if (!response.ok) throw new Error('TABAPAY_HTTP_ERROR')
   return (await response.json()) as TabapayResponse
}

export async function createTabapayPayment(input: {
   amountRial: number
   orderNumber: number
   mobile?: string
}) {
   const config = getConfig()
   if (!isTabapayAmountValid(input.amountRial)) {
      throw new Error('TABAPAY_AMOUNT_OUT_OF_RANGE')
   }

   const result = await postForm(config.createUrl, {
      amount: String(input.amountRial),
      callbackURL: `${config.appUrl}/api/payments/tabapay/callback`,
      description: `Avaluona Shop order #${input.orderNumber}`,
      additionalData: JSON.stringify({ orderNumber: input.orderNumber }),
      ...(input.mobile && /^09\d{9}$/.test(input.mobile)
         ? { mobile: input.mobile }
         : {}),
   })

   if (
      result.status !== 'success' ||
      result.responseCode !== 1 ||
      !result.token ||
      !result.url
   ) {
      throw new Error(result.message || 'TABAPAY_CREATE_FAILED')
   }

   const paymentUrl = new URL(result.url)
   if (
      paymentUrl.protocol !== 'https:' ||
      paymentUrl.hostname !== 'api.tabapay.ir'
   ) {
      throw new Error('TABAPAY_INVALID_PAYMENT_URL')
   }

   return { token: result.token, paymentUrl: paymentUrl.toString() }
}

export async function verifyTabapayPayment(input: {
   token: string
   amountRial: number
}) {
   const config = getConfig()
   const result = await postForm(config.verifyUrl, {
      token: input.token,
      amount: String(input.amountRial),
   })

   if (result.status === 'success' && result.responseCode === 1) {
      if (
         result.token !== input.token ||
         Number(result.amount) !== input.amountRial
      ) {
         throw new Error('TABAPAY_VERIFICATION_MISMATCH')
      }
      return true
   }

   // Only a provider response explicitly marked "failed" is definitive.
   // "error", missing fields, malformed JSON and transport failures are
   // ambiguous and must not release a stock reservation.
   if (result.status === 'failed' && typeof result.responseCode === 'number') {
      return false
   }

   throw new Error('TABAPAY_VERIFICATION_UNCONFIRMED')
}
