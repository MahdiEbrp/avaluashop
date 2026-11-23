export type ShippingMethodType = 'FlatRate' | 'Free' | 'FreeAbove' | 'CarrierCalculated'

/* Live carrier pricing is not wired to any provider yet: such methods are
   read-only in the admin screen, so the edit form only ever accepts the
   hand-priced types. Mapping keeps the select's value valid either way. */
export type EditableShippingMethodType = Exclude<ShippingMethodType, 'CarrierCalculated'>

export function editableMethodType(type: ShippingMethodType): EditableShippingMethodType {
   return type === 'CarrierCalculated' ? 'FlatRate' : type
}

export interface ShippingMethodQuoteInput {
   type: ShippingMethodType
   amount: number
   freeAbove: number | null
   allowedCities: string[]
}

export interface ShippingQuote {
   available: boolean
   amount: number
   reason?: 'CITY_NOT_SUPPORTED' | 'CARRIER_QUOTE_UNAVAILABLE'
}

/* Arabic and Persian share letters that render alike but differ by code point,
   and both keyboards reach real users. Folding them (plus ZWNJ and tatweel)
   keeps "كرج" and "کرج" the same city. */
const LETTER_FOLDS: readonly (readonly [RegExp, string])[] = [
   [/[يیۍ]/g, 'ی'],
   [/[كک]/g, 'ک'],
   [/[أإآٱ]/g, 'ا'],
   [/[ةۀ]/g, 'ه'],
   [/ؤ/g, 'و'],
   [/\u0640/g, ''],
   [/\u200C/g, ''],
]

/* U+06F0 (۰) and U+0660 (٠) start the two digit ranges. */
const PERSIAN_DIGIT_ZERO = 1776
const ARABIC_DIGIT_ZERO = 1632

/* Persian ۰-۹ and Arabic-Indic ٠-٩ digits mean the same numbers. */
function toAsciiDigits(value: string) {
   return value.replaceAll(/[\u06F0-\u06F9\u0660-\u0669]/g, (digit) => {
      /* Both ranges are single BMP code units, so the code point is the digit's code. */
      const code = digit.codePointAt(0)

      return String(code - (code >= PERSIAN_DIGIT_ZERO ? PERSIAN_DIGIT_ZERO : ARABIC_DIGIT_ZERO))
   })
}

export function normalizeCity(city?: string | null) {
   let value = toAsciiDigits((city ?? '').trim().replaceAll(/\s+/g, ' '))

   for (const [pattern, replacement] of LETTER_FOLDS) value = value.replaceAll(pattern, replacement)

   return value.toLocaleLowerCase('fa-IR')
}

/**
 * Split an administrator-entered city list. The field is free text, so every
 * separator an Iranian keyboard produces has to work: ASCII comma, Persian
 * comma, semicolon and newlines.
 */
export function parseAllowedCities(value: string) {
   return [
      ...new Set(
         value
            .split(/[,،;\n\r]+/)
            .map((city) => city.trim())
            .filter(Boolean)
      ),
   ]
}

export function quoteShipping(
   method: ShippingMethodQuoteInput,
   city: string,
   discountedSubtotal: number
): ShippingQuote {
   if (
      method.allowedCities.length > 0 &&
      !method.allowedCities.some((allowed) => normalizeCity(allowed) === normalizeCity(city))
   ) {
      return { available: false, amount: 0, reason: 'CITY_NOT_SUPPORTED' }
   }

   if (method.type === 'CarrierCalculated') {
      return { available: false, amount: 0, reason: 'CARRIER_QUOTE_UNAVAILABLE' }
   }

   if (method.type === 'Free') return { available: true, amount: 0 }

   if (method.type === 'FreeAbove' && discountedSubtotal >= (method.freeAbove ?? Infinity)) {
      return { available: true, amount: 0 }
   }

   const amount = Number.isFinite(method.amount) ? Math.max(0, method.amount) : 0
   return { available: true, amount: Number(amount.toFixed(2)) }
}

export function calculateDiscountedSubtotal(
   items: { count: number; product: { price: number; discount: number } }[],
   coupon: { percent: number; maxDiscountAmount: number } | null
) {
   const total = items.reduce((sum, item) => sum + item.count * item.product.price, 0)
   const rawProductDiscount = items.reduce(
      (sum, item) => sum + item.count * item.product.discount,
      0
   )
   const productDiscount = Math.min(total, Math.max(0, rawProductDiscount))
   const afterProductDiscount = Math.max(0, total - productDiscount)
   const percent = coupon ? Math.min(100, Math.max(0, coupon.percent)) : 0
   const couponDiscount = coupon
      ? Math.min(
           afterProductDiscount,
           Math.max(0, afterProductDiscount * (percent / 100)),
           Math.max(0, coupon.maxDiscountAmount)
        )
      : 0

   return {
      total,
      discount: productDiscount + couponDiscount,
      subtotalAfterDiscount: Math.max(0, afterProductDiscount - couponDiscount),
   }
}

export function calculateOrderTotals(
   items: { count: number; product: { price: number; discount: number } }[],
   coupon: { percent: number; maxDiscountAmount: number } | null,
   tax: { enabled: boolean; rate: number },
   shipping: number
) {
   const { total, discount, subtotalAfterDiscount: taxable } =
      calculateDiscountedSubtotal(items, coupon)
   const taxRate = tax.enabled ? Math.min(1, Math.max(0, tax.rate)) : 0
   const taxAmount = taxable * taxRate
   const safeShipping = Number.isFinite(shipping) ? Math.max(0, shipping) : 0
   const payable = taxable + taxAmount + safeShipping

   return {
      total: Number(total.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      tax: Number(taxAmount.toFixed(2)),
      shipping: Number(safeShipping.toFixed(2)),
      payable: Number(payable.toFixed(2)),
      taxRateSnapshot: taxRate,
   }
}
