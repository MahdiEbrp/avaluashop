import prisma from '@/lib/prisma'

export async function releasePendingOrder(orderId: string, paymentId?: string) {
   return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
         where: { id: orderId },
         include: { orderItems: true },
      })

      if (!order || order.isPaid || order.status !== 'PendingPayment') return false

      const cancelled = await tx.order.updateMany({
         where: { id: orderId, status: 'PendingPayment', isPaid: false },
         data: { status: 'Cancelled' },
      })
      if (cancelled.count !== 1) return false

      if (paymentId) {
         const payment = await tx.payment.updateMany({
            where: { id: paymentId, orderId, status: 'Processing' },
            data: { status: 'Failed' },
         })
         if (payment.count !== 1) throw new Error('PAYMENT_STATE_CONFLICT')
      }

      for (const item of order.orderItems) {
         await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.count } },
         })
      }

      if (order.discountCodeId) {
         await tx.discountCode.update({
            where: { id: order.discountCodeId },
            data: { stock: { increment: 1 } },
         })
      }

      return true
   })
}

export async function completePendingOrder(orderId: string, paymentId: string) {
   return prisma.$transaction(async (tx) => {
      const paid = await tx.payment.updateMany({
         where: { id: paymentId, orderId, status: 'Processing' },
         data: { status: 'Paid', isSuccessful: true },
      })

      if (paid.count === 0) {
         const existing = await tx.payment.findUnique({ where: { id: paymentId } })
         if (existing?.status === 'Paid') return false
         throw new Error('PAYMENT_STATE_CONFLICT')
      }

      const completed = await tx.order.updateMany({
         where: { id: orderId, status: 'PendingPayment', isPaid: false },
         data: { isPaid: true, status: 'Processing' },
      })

      if (completed.count !== 1) throw new Error('ORDER_STATE_CONFLICT')

      const order = await tx.order.findUnique({
         where: { id: orderId },
         include: { orderItems: true },
      })
      if (order) {
         for (const item of order.orderItems) {
            const cartLine = await tx.cartItem.findUnique({
               where: {
                  UniqueCartItem: {
                     cartId: order.userId,
                     productId: item.productId,
                  },
               },
            })
            if (!cartLine) continue
            if (cartLine.count > item.count) {
               await tx.cartItem.update({
                  where: {
                     UniqueCartItem: {
                        cartId: order.userId,
                        productId: item.productId,
                     },
                  },
                  data: { count: { decrement: item.count } },
               })
            } else {
               await tx.cartItem.delete({
                  where: {
                     UniqueCartItem: {
                        cartId: order.userId,
                        productId: item.productId,
                     },
                  },
               })
            }
         }
      }

      return true
   })
}
