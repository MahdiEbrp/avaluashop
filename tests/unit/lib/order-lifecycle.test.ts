export {}

/* The lifecycle helpers run inside `prisma.$transaction`, whose mock hands the
   same delegate object back — so the assertions below read the shared spies. */
vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

const { releasePendingOrder, completePendingOrder } = await import(
   '@/lib/payments/order-lifecycle'
)
const { prismaMock } = await import('../support/db')

const orderWithItems = {
   id: 'o1',
   userId: 'u1',
   status: 'PendingPayment',
   isPaid: false,
   orderItems: [
      { productId: 'p1', count: 2 },
      { productId: 'p2', count: 1 },
   ],
}

beforeEach(() => {
   vi.spyOn(console, 'error').mockImplementation(() => {})
   prismaMock.order.findUnique.mockResolvedValue(orderWithItems)
   prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
   prismaMock.payment.updateMany.mockResolvedValue({ count: 1 })
   prismaMock.payment.findUnique.mockResolvedValue({ status: 'Processing' })
   prismaMock.product.update.mockResolvedValue({})
   prismaMock.cartItem.findUnique.mockResolvedValue({ count: 3 })
   prismaMock.cartItem.update.mockResolvedValue({})
   prismaMock.cartItem.delete.mockResolvedValue({})
})

afterEach(() => {
   vi.restoreAllMocks()
})

describe('releasePendingOrder', () => {
   it('cancels the order, fails the payment and restores stock', async () => {
      await expect(releasePendingOrder('o1', 'pay1')).resolves.toBe(true)

      expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
         where: { id: 'o1', status: 'PendingPayment', isPaid: false },
         data: { status: 'Cancelled' },
      })
      expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
         where: { id: 'pay1', status: 'Processing' },
         data: { status: 'Failed' },
      })
      /* Every purchased unit goes back on the shelf. */
      expect(prismaMock.product.update).toHaveBeenCalledWith({
         where: { id: 'p1' },
         data: { stock: { increment: 2 } },
      })
      expect(prismaMock.product.update).toHaveBeenCalledWith({
         where: { id: 'p2' },
         data: { stock: { increment: 1 } },
      })
   })

   it('restores stock without touching payments when no payment is given', async () => {
      await expect(releasePendingOrder('o1')).resolves.toBe(true)

      expect(prismaMock.payment.updateMany).not.toHaveBeenCalled()
      expect(prismaMock.product.update).toHaveBeenCalledTimes(2)
   })

   it('does nothing when the order is missing', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null)

      await expect(releasePendingOrder('nope')).resolves.toBe(false)
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled()
   })

   it('leaves a paid order alone', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...orderWithItems, isPaid: true })

      await expect(releasePendingOrder('o1')).resolves.toBe(false)
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled()
      expect(prismaMock.product.update).not.toHaveBeenCalled()
   })

   it('leaves an order that is no longer pending alone', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
         ...orderWithItems,
         status: 'Processing',
      })

      await expect(releasePendingOrder('o1')).resolves.toBe(false)
   })

   it('stops when another actor already moved the order on', async () => {
      prismaMock.order.updateMany.mockResolvedValue({ count: 0 })

      await expect(releasePendingOrder('o1', 'pay1')).resolves.toBe(false)
      expect(prismaMock.payment.updateMany).not.toHaveBeenCalled()
      expect(prismaMock.product.update).not.toHaveBeenCalled()
   })

   it('raises a state conflict when the payment moved on too', async () => {
      prismaMock.payment.updateMany.mockResolvedValue({ count: 0 })

      await expect(releasePendingOrder('o1', 'pay1')).rejects.toThrow(
         'PAYMENT_STATE_CONFLICT'
      )
   })
})

describe('completePendingOrder', () => {
   it('marks the payment paid and the order processing', async () => {
      await expect(completePendingOrder('o1', 'pay1')).resolves.toBe(true)

      expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
         where: { id: 'pay1', status: 'Processing' },
         data: { status: 'Paid', isSuccessful: true },
      })
      expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
         where: { id: 'o1', status: 'PendingPayment', isPaid: false },
         data: { isPaid: true, status: 'Processing' },
      })
   })

   it('decrements a cart line that holds more than was bought', async () => {
      await completePendingOrder('o1', 'pay1')

      expect(prismaMock.cartItem.update).toHaveBeenCalledWith({
         where: { UniqueCartItem: { cartId: 'u1', productId: 'p1' } },
         data: { count: { decrement: 2 } },
      })
   })

   it('removes a cart line that only held the purchased quantity', async () => {
      prismaMock.cartItem.findUnique.mockResolvedValue({ count: 2 })

      await completePendingOrder('o1', 'pay1')

      expect(prismaMock.cartItem.delete).toHaveBeenCalledWith({
         where: { UniqueCartItem: { cartId: 'u1', productId: 'p1' } },
      })
   })

   it('skips a product that is no longer in the cart', async () => {
      prismaMock.cartItem.findUnique.mockResolvedValue(null)

      await completePendingOrder('o1', 'pay1')

      expect(prismaMock.cartItem.update).not.toHaveBeenCalled()
      expect(prismaMock.cartItem.delete).not.toHaveBeenCalled()
   })

   it('treats a repeated callback on a paid payment as already settled', async () => {
      prismaMock.payment.updateMany.mockResolvedValue({ count: 0 })
      prismaMock.payment.findUnique.mockResolvedValue({ status: 'Paid' })

      await expect(completePendingOrder('o1', 'pay1')).resolves.toBe(false)
   })

   it('raises a state conflict for a payment in an unexpected state', async () => {
      prismaMock.payment.updateMany.mockResolvedValue({ count: 0 })
      prismaMock.payment.findUnique.mockResolvedValue({ status: 'Failed' })

      await expect(completePendingOrder('o1', 'pay1')).rejects.toThrow(
         'PAYMENT_STATE_CONFLICT'
      )
   })

   it('raises an order conflict when the order cannot be completed', async () => {
      prismaMock.order.updateMany.mockResolvedValue({ count: 0 })

      await expect(completePendingOrder('o1', 'pay1')).rejects.toThrow(
         'ORDER_STATE_CONFLICT'
      )
   })

   it('tolerates a vanished order after the payment is settled', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null)

      await expect(completePendingOrder('o1', 'pay1')).resolves.toBe(true)
      expect(prismaMock.cartItem.findUnique).not.toHaveBeenCalled()
   })
})

describe('redirectToPayment', () => {
   afterEach(() => {
      vi.unstubAllGlobals()
   })

   it('hands the gateway URL to the browser', async () => {
      const assign = vi.fn()
      vi.stubGlobal('window', { location: { assign } })

      const { redirectToPayment } = await import('@/lib/payments/redirect')
      redirectToPayment('https://api.tabapay.ir/pay/abc')

      expect(assign).toHaveBeenCalledWith('https://api.tabapay.ir/pay/abc')
   })
})
