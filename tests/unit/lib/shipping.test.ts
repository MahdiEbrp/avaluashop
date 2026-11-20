import { calculateDiscountedSubtotal, calculateOrderTotals, quoteShipping } from '@/lib/shipping'

describe('quoteShipping', () => {
   const flat = {
      type: 'FlatRate' as const,
      amount: 35,
      freeAbove: null,
      allowedCities: [],
   }

   it('quotes a flat rate', () => {
      expect(quoteShipping(flat, 'تهران', 100)).toEqual({ available: true, amount: 35 })
   })

   it('quotes free shipping as zero even if an amount was stored', () => {
      expect(quoteShipping({ ...flat, type: 'Free' }, 'تهران', 100)).toEqual({
         available: true,
         amount: 0,
      })
   })

   it('applies the free-above threshold at the discounted subtotal', () => {
      const method = { ...flat, type: 'FreeAbove' as const, freeAbove: 100 }
      expect(quoteShipping(method, 'تهران', 100)).toEqual({ available: true, amount: 0 })
      expect(quoteShipping(method, 'تهران', 99)).toEqual({ available: true, amount: 35 })
   })

   it('compares allowed cities after trimming and normalizing case', () => {
      expect(quoteShipping({ ...flat, allowedCities: [' تهران '] }, 'تهران', 0).available).toBe(true)
   })

   it('rejects a city outside the allow-list', () => {
      expect(quoteShipping({ ...flat, allowedCities: ['تهران'] }, 'کرج', 0)).toEqual({
         available: false,
         amount: 0,
         reason: 'CITY_NOT_SUPPORTED',
      })
   })

   it('does not pretend carrier-calculated methods have a live quote', () => {
      expect(quoteShipping({ ...flat, type: 'CarrierCalculated' }, 'تهران', 0)).toEqual({
         available: false,
         amount: 0,
         reason: 'CARRIER_QUOTE_UNAVAILABLE',
      })
   })
})

describe('calculateDiscountedSubtotal', () => {
   it('includes both product and coupon discounts for shipping thresholds', () => {
      const items = [{ count: 1, product: { price: 200, discount: 20 } }]
      expect(calculateDiscountedSubtotal(items, { percent: 10, maxDiscountAmount: 50 })).toEqual({
         total: 200,
         discount: 38,
         subtotalAfterDiscount: 162,
      })
   })
})

describe('calculateOrderTotals', () => {
   const items = [
      { count: 2, product: { price: 100, discount: 5 } },
      { count: 1, product: { price: 50, discount: 0 } },
   ]

   it('calculates product discount, coupon, tax and shipping', () => {
      expect(
         calculateOrderTotals(
            items,
            { percent: 10, maxDiscountAmount: 20 },
            { enabled: true, rate: 0.1 },
            25
         )
      ).toEqual({
         total: 250,
         discount: 30,
         tax: 22,
         shipping: 25,
         payable: 267,
         taxRateSnapshot: 0.1,
      })
   })

   it('stores a zero tax snapshot when tax is disabled', () => {
      const result = calculateOrderTotals(items, null, { enabled: false, rate: 0.09 }, 0)
      expect(result.tax).toBe(0)
      expect(result.taxRateSnapshot).toBe(0)
      expect(result.payable).toBe(240)
   })

   it('clamps invalid negative shipping and tax rates', () => {
      const result = calculateOrderTotals(items, null, { enabled: true, rate: -1 }, -10)
      expect(result.tax).toBe(0)
      expect(result.shipping).toBe(0)
      expect(result.payable).toBe(240)
   })
})
