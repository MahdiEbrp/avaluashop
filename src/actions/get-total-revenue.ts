import prisma from '@/lib/prisma'

/** Revenue is the amount actually charged for paid orders, including the
 * order-level shipping/tax/discount calculation captured at checkout. */
export const getTotalRevenue = async () => {
   const paidOrders = await prisma.order.findMany({
      where: { isPaid: true },
      select: { payable: true },
   })

   return paidOrders.reduce((total, order) => total + order.payable, 0)
}
