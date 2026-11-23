/* The "is this order discounted at all" question is answered by the caller
   (a discount object is either attached or it is not), so this only computes
   the amount for a discount that is actually applicable. */
export function calculateDiscountAmount(totalAmount: number, discountObject?) {
   if (discountObject && isDiscountAcceptable(discountObject)) {
      const { maxAmount, percentage } = discountObject

      const discountableAmount = Math.floor(totalAmount * (percentage / 100))
      const discountAmount = Math.min(discountableAmount, maxAmount)

      return discountAmount
   } else return 0
}

export function calculateReferralAmount(
   isReferred: boolean,
   totalAmount: number
) {
   const referralDiscountPercentageToConsumer = 10
   const maxReferralDiscount = 10

   if (isReferred) {
      const discountableAmount = Math.floor(
         totalAmount * (referralDiscountPercentageToConsumer / 100)
      )
      const referralDiscount = Math.min(discountableAmount, maxReferralDiscount)

      return referralDiscount
   } else return 0
}

export function calculatePayableAmount(
   isDiscounted: boolean,
   isReferred: boolean,
   totalAmount: number,
   discountObject
) {
   let payableAmount = totalAmount

   if (isDiscounted && discountObject) {
      payableAmount -= calculateDiscountAmount(totalAmount, discountObject)
   }

   if (isReferred) {
      payableAmount -= calculateReferralAmount(isReferred, totalAmount)
   }

   return payableAmount
}

export function isDiscountAcceptable(discountObject) {
   const { maxUses, burntUses } = discountObject

   return maxUses > burntUses
}
