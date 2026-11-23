import {
   calculateDiscountAmount,
   calculatePayableAmount,
   calculateReferralAmount,
   isDiscountAcceptable,
} from '@/lib/order'

describe('isDiscountAcceptable', () => {
   it('accepts a code that still has uses left', () => {
      expect(isDiscountAcceptable({ maxUses: 10, burntUses: 9 })).toBe(true)
   })

   it('rejects an exhausted code', () => {
      expect(isDiscountAcceptable({ maxUses: 10, burntUses: 10 })).toBe(false)
      expect(isDiscountAcceptable({ maxUses: 3, burntUses: 99 })).toBe(false)
   })
})

describe('calculateDiscountAmount', () => {
   const discount = { percentage: 20, maxAmount: 100, maxUses: 5, burntUses: 0 }

   it('takes the percentage of the total', () => {
      expect(calculateDiscountAmount(1000, discount)).toBe(100)
   })

   it('floors fractional discounts', () => {
      expect(calculateDiscountAmount(999, { ...discount, percentage: 10 })).toBe(99)
   })

   it('never exceeds the max amount', () => {
      expect(calculateDiscountAmount(10_000, discount)).toBe(100)
   })

   it('is zero without a discount object', () => {
      expect(calculateDiscountAmount(1000, null)).toBe(0)
      expect(calculateDiscountAmount(1000)).toBe(0)
   })

   it('is zero for an exhausted code', () => {
      expect(
         calculateDiscountAmount(1000, { ...discount, burntUses: 5, maxUses: 5 })
      ).toBe(0)
   })
})

describe('calculateReferralAmount', () => {
   it('gives 10% of the total, capped at 10', () => {
      expect(calculateReferralAmount(true, 50)).toBe(5)
      expect(calculateReferralAmount(true, 500)).toBe(10)
   })

   it('floors the percentage and returns 0 for a small basket', () => {
      expect(calculateReferralAmount(true, 9)).toBe(0)
   })

   it('is zero when the buyer was not referred', () => {
      expect(calculateReferralAmount(false, 500)).toBe(0)
   })
})

describe('calculatePayableAmount', () => {
   const discount = { percentage: 10, maxAmount: 100, maxUses: 5, burntUses: 0 }

   it('returns the total untouched with no discount and no referral', () => {
      expect(calculatePayableAmount(false, false, 200, null)).toBe(200)
   })

   it('subtracts a discount', () => {
      expect(calculatePayableAmount(true, false, 200, discount)).toBe(180)
   })

   it('ignores the discount when the flag is set but no object is attached', () => {
      expect(calculatePayableAmount(true, false, 200, null)).toBe(200)
   })

   it('subtracts a referral discount too', () => {
      expect(calculatePayableAmount(false, true, 200, null)).toBe(190)
   })

   it('stack a discount and a referral', () => {
      expect(calculatePayableAmount(true, true, 200, discount)).toBe(170)
   })
})
