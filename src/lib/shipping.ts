export type ShippingMethodQuoteInput = {
   type: 'FlatRate' | 'Free' | 'FreeAbove' | 'CarrierCalculated'
   amount: number
   freeAbove: number | null
   allowedCities: string[]
}

export type ShippingQuote = {
   available: boolean
   amount: number
   reason?: 'CITY_NOT_SUPPORTED' | 'CARRIER_QUOTE_UNAVAILABLE'
}

function normalizeCity(city: string) {
   return city.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fa-IR')
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
   items: Array<{ count: number; product: { price: number; discount: number } }>,
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
   items: Array<{ count: number; product: { price: number; discount: number } }>,
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
