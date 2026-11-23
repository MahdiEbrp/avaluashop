import prisma from '@/lib/prisma'

export const getStockCount = () => {
   return Promise.resolve(prisma.product.count({
      where: {
         isAvailable: true,
         stock: { gt: 0 },
      },
   }))
}
