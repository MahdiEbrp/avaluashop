import {
   calculateDiscountedSubtotal,
   editableMethodType,
   calculateOrderTotals,
   normalizeCity,
   parseAllowedCities,
   quoteShipping,
} from '@/lib/shipping'

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

   it('treats a non-finite shipping fee as zero', () => {
      const result = calculateOrderTotals(items, null, { enabled: true, rate: 0.09 }, Number.NaN)
      expect(result.shipping).toBe(0)
      expect(result.payable).toBe(261.6)
   })

   it('clamps invalid negative shipping and tax rates', () => {
      const result = calculateOrderTotals(items, null, { enabled: true, rate: -1 }, -10)
      expect(result.tax).toBe(0)
      expect(result.shipping).toBe(0)
      expect(result.payable).toBe(240)
   })
})

describe('normalizeCity', () => {
   it('folds the Arabic letters Iranians actually type', () => {
      expect(normalizeCity('كرج')).toBe(normalizeCity('کرج'))
      expect(normalizeCity('اصفهان')).toBe(normalizeCity('اصفهان'))
      expect(normalizeCity('أباد')).toBe(normalizeCity('اباد'))
      expect(normalizeCity('خانة')).toBe(normalizeCity('خانه'))
   })

   it('removes ZWNJ and tatweel', () => {
      expect(normalizeCity('می‌اندآب')).toBe(normalizeCity('میاندآب'))
      expect(normalizeCity('تـــهران')).toBe(normalizeCity('تهران'))
   })

   it('converts Persian and Arabic-Indic digits to ASCII', () => {
      expect(normalizeCity('منطقه ۱')).toBe('منطقه 1')
      expect(normalizeCity('منطقه ٢')).toBe('منطقه 2')
   })

   it('collapses whitespace and tolerates junk input', () => {
      expect(normalizeCity('  تهران   نو ')).toBe('تهران نو')
      expect(normalizeCity(null)).toBe('')
      expect(normalizeCity()).toBe('')
   })
})

describe('parseAllowedCities', () => {
   it('accepts every separator an Iranian keyboard produces', () => {
      expect(parseAllowedCities('تهران، کرج,اصفهان;شیراز')).toEqual([
         'تهران',
         'کرج',
         'اصفهان',
         'شیراز',
      ])
   })

   it('splits on newlines and drops duplicates and blanks', () => {
      expect(parseAllowedCities('تهران\n کرج \nتهران\n\n')).toEqual(['تهران', 'کرج'])
   })

   it('returns an empty list for empty input', () => {
      expect(parseAllowedCities('  ')).toEqual([])
   })
})

describe('quoteShipping edge cases', () => {
   const flat = { type: 'FlatRate' as const, amount: 35, freeAbove: null, allowedCities: [] }

   it('serves every city when the allow-list is empty', () => {
      expect(quoteShipping(flat, 'هر شهری', 0)).toEqual({ available: true, amount: 35 })
   })

   it('never quotes a carrier-calculated method before the carrier API exists', () => {
      expect(quoteShipping({ ...flat, type: 'CarrierCalculated' }, 'تهران', 0)).toEqual({
         available: false,
         amount: 0,
         reason: 'CARRIER_QUOTE_UNAVAILABLE',
      })
   })

   it('refuses a city outside the allow-list', () => {
      expect(quoteShipping({ ...flat, allowedCities: ['تهران'] }, 'کرج', 0)).toEqual({
         available: false,
         amount: 0,
         reason: 'CITY_NOT_SUPPORTED',
      })
   })

   it('charges the base rate for FreeAbove without a threshold', () => {
      expect(quoteShipping({ ...flat, type: 'FreeAbove' }, 'تهران', 1_000_000)).toEqual({
         available: true,
         amount: 35,
      })
   })

   it('treats a non-finite amount as zero', () => {
      expect(quoteShipping({ ...flat, amount: Number.NaN }, 'تهران', 0)).toEqual({
         available: true,
         amount: 0,
      })
   })

   it('clamps a negative amount', () => {
      expect(quoteShipping({ ...flat, amount: -5 }, 'تهران', 0)).toEqual({
         available: true,
         amount: 0,
      })
   })
})

describe('editableMethodType', () => {
   it('maps a carrier-priced method to a flat rate', () => {
      expect(editableMethodType('CarrierCalculated')).toBe('FlatRate')
   })

   it('passes every hand-priced type through unchanged', () => {
      expect(['FlatRate', 'Free', 'FreeAbove'].map((type) => editableMethodType(type as 'Free'))).toEqual([
         'FlatRate',
         'Free',
         'FreeAbove',
      ])
   })
})
