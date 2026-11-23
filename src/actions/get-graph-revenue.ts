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
   const year = new Date().getFullYear()
   const paidOrders = await prisma.order.findMany({
      where: {
         isPaid: true,
         createdAt: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
         },
      },
      select: { createdAt: true, payable: true },
   })

   const monthlyRevenue = Array.from({ length: 12 }, () => 0)

   for (const order of paidOrders) {
      monthlyRevenue[order.createdAt.getMonth()] += order.payable
   }

   return MONTHS.map((name, index) => ({
      name,
      total: monthlyRevenue[index],
   }))
}
