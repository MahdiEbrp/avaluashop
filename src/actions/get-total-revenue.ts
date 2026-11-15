import prisma from '@/lib/prisma'

export const getTotalRevenue = async () => {
   const paidOrders = await prisma.order.findMany({
      where: {
         isPaid: true,
      },
      include: {
         orderItems: {
            include: {
               product: { include: { categories: true } },
            },
         },
      },
   })

   let totalRevenue = 0

   for (const order of paidOrders) {
      for (const item of order.orderItems) {
         totalRevenue += item.price
      }
   }

   return totalRevenue
}
