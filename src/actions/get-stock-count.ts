import prisma from '@/lib/prisma'

export const getStockCount = async () => {
   return prisma.product.count({
      where: {
         isAvailable: true,
         stock: { gt: 0 },
      },
   })
}
