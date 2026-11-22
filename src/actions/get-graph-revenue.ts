import prisma from '@/lib/prisma'

interface GraphData {
   name: string
   total: number
}

const MONTHS = [
   'Jan',
   'Feb',
   'Mar',
   'Apr',
   'May',
   'Jun',
   'Jul',
   'Aug',
   'Sep',
   'Oct',
   'Nov',
   'Dec',
]

export const getGraphRevenue = async (): Promise<GraphData[]> => {
   /* The chart is an annual month-by-month view. Revenue uses the final
      order payable, and the query selects only the two fields it needs. */
   const paidOrders = await prisma.order.findMany({
      where: { isPaid: true },
      select: { createdAt: true, payable: true },
   })

   const monthlyRevenue = Array.from({ length: 12 }, () => 0)

   for (const order of paidOrders) {
      const month = order.createdAt.getMonth()
      monthlyRevenue[month] += order.payable
   }

   return MONTHS.map((name, index) => ({
      name,
      total: monthlyRevenue[index],
   }))
}
