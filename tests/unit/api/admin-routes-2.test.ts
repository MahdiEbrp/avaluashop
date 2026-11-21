import { GET as productsGET, POST as productsPOST } from '@/app/api/admin/products/route'
import {
   DELETE as productDEL,
   GET as productGET,
   PATCH as productPATCH,
} from '@/app/api/admin/products/[productId]/route'
import { GET as orderGET, PATCH as orderPATCH } from '@/app/api/admin/orders/[orderId]/route'
import {
   GET as paymentGET,
   PATCH as paymentPATCH,
} from '@/app/api/admin/payments/[paymentId]/route'
import {
   DELETE as userDEL,
   GET as userGET,
   PATCH as userPATCH,
} from '@/app/api/admin/users/[userId]/route'

import { call, get, json, prismaMock, silenceConsole, USER } from './helpers'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))
vi.mock('next/cache', () => import('../support/cache'))

beforeEach(() => silenceConsole())

describe('admin products', () => {
   it('list endpoints require a session', async () => {
      expect((await productsGET(get())).status).toBe(401)
      expect((await productsPOST(json({}))).status).toBe(401)
   })

   it('GET filters by category and featured flag', async () => {
      prismaMock.product.findMany.mockResolvedValue([{ id: 'p1' }])

      const response = await productsGET(
         get(USER, 'http://localhost/api/admin/products?categoryId=c1&isFeatured=true')
      )

      await expect(response.json()).resolves.toEqual([{ id: 'p1' }])
      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
         where: { categoryId: 'c1', isFeatured: true },
      })
   })

   it('GET omits the featured filter when it is absent', async () => {
      prismaMock.product.findMany.mockResolvedValue([])

      await productsGET(get(USER, 'http://localhost/api/admin/products'))

      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
         where: { categoryId: undefined },
      })
   })

   it('GET answers 500 on failure', async () => {
      prismaMock.product.findMany.mockRejectedValue(new Error('down'))

      expect((await productsGET(get(USER))).status).toBe(500)
   })

   it('POST is a listing alias for the admin table', async () => {
      prismaMock.product.findMany.mockResolvedValue([{ id: 'p1' }])

      await expect((await productsPOST(json({}, USER))).json()).resolves.toEqual([{ id: 'p1' }])
   })

   it('POST answers 500 on failure', async () => {
      prismaMock.product.findMany.mockRejectedValue(new Error('down'))

      expect((await productsPOST(json({}, USER))).status).toBe(500)
   })

   it('single-product routes require a session', async () => {
      expect((await productGET(get(), call({ productId: 'p1' }))).status).toBe(401)
      expect((await productDEL(get(), call({ productId: 'p1' }))).status).toBe(401)
      expect((await productPATCH(json({}), call({ productId: 'p1' }))).status).toBe(401)
   })

   it('GET returns the product or 400 for a missing id', async () => {
      prismaMock.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1' })

      expect((await productGET(get(USER), call({ productId: 'p1' }))).status).toBe(200)
      expect((await productGET(get(USER), call({ productId: '' }))).status).toBe(400)
   })

   it('GET answers 500 for a missing row', async () => {
      prismaMock.product.findUniqueOrThrow.mockRejectedValue(new Error('P2025'))

      expect((await productGET(get(USER), call({ productId: 'x' }))).status).toBe(500)
   })

   it('DELETE removes the product', async () => {
      prismaMock.product.delete.mockResolvedValue({ id: 'p1' })

      const response = await productDEL(get(USER), call({ productId: 'p1' }))

      expect(response.status).toBe(200)
   })

   it('DELETE answers 500 on failure', async () => {
      prismaMock.product.delete.mockRejectedValue(new Error('down'))

      expect((await productDEL(get(USER), call({ productId: 'p1' }))).status).toBe(500)
   })

   it('PATCH writes the editable product fields', async () => {
      prismaMock.product.update.mockResolvedValue({ id: 'p1' })

      const response = await productPATCH(
         json(
            {
               data: {
                  title: 'New',
                  price: 10,
                  discount: 1,
                  stock: 5,
                  isFeatured: true,
                  isAvailable: true,
               },
            },
            USER
         ),
         call({ productId: 'p1' })
      )

      expect(response.status).toBe(200)
      expect(prismaMock.product.update).toHaveBeenCalledWith({
         where: { id: 'p1' },
         data: {
            title: 'New',
            price: 10,
            discount: 1,
            stock: 5,
            isFeatured: true,
            isAvailable: true,
         },
      })
   })

   it('PATCH rejects a missing id', async () => {
      const response = await productPATCH(
         json({ data: {} }, USER),
         call({ productId: '' })
      )

      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Product Id is required')
   })

   it('PATCH answers 500 on failure', async () => {
      prismaMock.product.update.mockRejectedValue(new Error('down'))

      expect(
         (await productPATCH(json({ data: {} }, USER), call({ productId: 'p1' }))).status
      ).toBe(500)
   })
})

describe('admin orders', () => {
   it('requires a session', async () => {
      expect((await orderGET(get(), call({ orderId: 'o1' }))).status).toBe(401)
      expect((await orderPATCH(json({}), call({ orderId: 'o1' }))).status).toBe(401)
   })

   it('GET returns the order or 404', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ id: 'o1' })
      expect((await orderGET(get(USER), call({ orderId: 'o1' }))).status).toBe(200)

      prismaMock.order.findUnique.mockResolvedValue(null)
      expect((await orderGET(get(USER), call({ orderId: 'nope' }))).status).toBe(404)
   })

   it('GET answers 500 on failure', async () => {
      prismaMock.order.findUnique.mockRejectedValue(new Error('down'))

      expect((await orderGET(get(USER), call({ orderId: 'o1' }))).status).toBe(500)
   })

   it('PATCH validates the status enum and money fields', async () => {
      const response = await orderPATCH(
         json({ status: 'Teleported', shipping: -1, payable: 'abc' }, USER),
         call({ orderId: 'o1' })
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ message: 'INVALID ORDER' })
   })

   it('PATCH accepts a nullable tracking number', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ id: 'o1' })
      prismaMock.order.update.mockResolvedValue({ id: 'o1', shippingTrackingNumber: 'TRK-123' })

      const response = await orderPATCH(
         json({ shippingTrackingNumber: 'TRK-123' }, USER),
         call({ orderId: 'o1' })
      )

      expect(response.status).toBe(200)
      expect(prismaMock.order.update).toHaveBeenCalledWith({
         where: { id: 'o1' },
         data: { shippingTrackingNumber: 'TRK-123' },
      })
   })

   it('PATCH rejects a tracking number longer than 100 characters', async () => {
      const response = await orderPATCH(
         json({ shippingTrackingNumber: 'x'.repeat(101) }, USER),
         call({ orderId: 'o1' })
      )
      expect(response.status).toBe(400)
   })

   it('PATCH clears the tracking number when the operator empties the field', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ id: 'o1' })
      prismaMock.order.update.mockResolvedValue({ id: 'o1', shippingTrackingNumber: null })

      const response = await orderPATCH(
         json({ shippingTrackingNumber: ' '.repeat(3) }, USER),
         call({ orderId: 'o1' })
      )

      expect(response.status).toBe(200)
      expect(prismaMock.order.update).toHaveBeenCalledWith({
         where: { id: 'o1' },
         data: { shippingTrackingNumber: null },
      })
   })

   it('PATCH trims the tracking number before saving it', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ id: 'o1' })
      prismaMock.order.update.mockResolvedValue({ id: 'o1' })

      await orderPATCH(json({ shippingTrackingNumber: '  TRK-1  ' }, USER), call({ orderId: 'o1' }))

      expect(prismaMock.order.update).toHaveBeenCalledWith({
         where: { id: 'o1' },
         data: { shippingTrackingNumber: 'TRK-1' },
      })
   })

   it('PATCH accepts clearing an existing tracking number with null', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ id: 'o1' })
      prismaMock.order.update.mockResolvedValue({ id: 'o1', shippingTrackingNumber: null })

      const response = await orderPATCH(
         json({ shippingTrackingNumber: null }, USER),
         call({ orderId: 'o1' })
      )

      expect(response.status).toBe(200)
      expect(prismaMock.order.update).toHaveBeenCalledWith({
         where: { id: 'o1' },
         data: { shippingTrackingNumber: null },
      })
   })

   it('PATCH drops fields the order schema does not own', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ id: 'o1' })
      prismaMock.order.update.mockResolvedValue({ id: 'o1' })

      const response = await orderPATCH(
         json({ shippingTrackingNumber: 'TRK-1', bogus: 1 }, USER),
         call({ orderId: 'o1' })
      )

      expect(response.status).toBe(200)
      expect(prismaMock.order.update).toHaveBeenCalledWith({
         where: { id: 'o1' },
         data: { shippingTrackingNumber: 'TRK-1' },
      })
   })

   it('PATCH rejects an empty patch', async () => {
      const response = await orderPATCH(json({}, USER), call({ orderId: 'o1' }))

      expect(response.status).toBe(400)
   })

   it('PATCH advances a paid order to shipped only with a tracking number', async () => {
      prismaMock.order.findUnique
         .mockResolvedValueOnce({
            id: 'o1',
            status: 'Processing',
            isPaid: true,
            shippingTrackingNumber: null,
         })
         .mockResolvedValueOnce({ id: 'o1', status: 'Shipped', shippingTrackingNumber: 'TRK-1' })
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 })

      const response = await orderPATCH(
         json({ status: 'Shipped', shippingTrackingNumber: 'TRK-1' }, USER),
         call({ orderId: 'o1' })
      )

      expect(response.status).toBe(200)
      expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
         where: {
            id: 'o1',
            status: 'Processing',
            isPaid: true,
            shippingTrackingNumber: null,
         },
         data: { status: 'Shipped', shippingTrackingNumber: 'TRK-1' },
      })
   })

   it('PATCH refuses to mark an order paid directly', async () => {
      const response = await orderPATCH(json({ isPaid: true }, USER), call({ orderId: 'o1' }))

      expect(response.status).toBe(400)
      expect(prismaMock.order.update).not.toHaveBeenCalled()
   })

   it('PATCH requires payment verification before shipping', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
         id: 'o1',
         status: 'Processing',
         isPaid: false,
         shippingTrackingNumber: null,
      })

      const response = await orderPATCH(
         json({ status: 'Shipped', shippingTrackingNumber: 'TRK-1' }, USER),
         call({ orderId: 'o1' })
      )

      expect(response.status).toBe(409)
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled()
   })

   it('PATCH requires a tracking number before shipping', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
         id: 'o1',
         status: 'Processing',
         isPaid: true,
         shippingTrackingNumber: null,
      })

      const response = await orderPATCH(
         json({ status: 'Shipped' }, USER),
         call({ orderId: 'o1' })
      )

      expect(response.status).toBe(400)
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled()
   })

   it('PATCH rejects transitions outside the fulfilment workflow', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
         id: 'o1',
         status: 'Processing',
         isPaid: true,
         shippingTrackingNumber: null,
      })

      const response = await orderPATCH(
         json({ status: 'Delivered' }, USER),
         call({ orderId: 'o1' })
      )

      expect(response.status).toBe(409)
   })

   it('PATCH marks a shipped order completed when delivered', async () => {
      prismaMock.order.findUnique
         .mockResolvedValueOnce({
            id: 'o1',
            status: 'Shipped',
            isPaid: true,
            shippingTrackingNumber: 'TRK-1',
         })
         .mockResolvedValueOnce({ id: 'o1', status: 'Delivered', isCompleted: true })
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 })

      const response = await orderPATCH(
         json({ status: 'Delivered' }, USER),
         call({ orderId: 'o1' })
      )

      expect(response.status).toBe(200)
      expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
         where: {
            id: 'o1',
            status: 'Shipped',
            isPaid: true,
            shippingTrackingNumber: 'TRK-1',
         },
         data: { status: 'Delivered', isCompleted: true },
      })
   })

   it('PATCH rejects clearing the tracking number on a shipped or delivered order', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
         id: 'o1',
         status: 'Shipped',
         isPaid: true,
         shippingTrackingNumber: 'TRK-1',
      })

      const clearedOnShipped = await orderPATCH(
         json({ status: 'Shipped', shippingTrackingNumber: '' }, USER),
         call({ orderId: 'o1' })
      )
      expect(clearedOnShipped.status).toBe(400)

      const clearedOnDeliver = await orderPATCH(
         json({ status: 'Delivered', shippingTrackingNumber: '' }, USER),
         call({ orderId: 'o1' })
      )
      expect(clearedOnDeliver.status).toBe(400)
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled()
      expect(prismaMock.order.update).not.toHaveBeenCalled()
   })

   it('PATCH answers 409 when a concurrent edit changes the order state', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
         id: 'o1',
         status: 'Processing',
         isPaid: true,
         shippingTrackingNumber: 'TRK-1',
      })
      prismaMock.order.updateMany.mockResolvedValue({ count: 0 })

      const response = await orderPATCH(
         json({ status: 'Shipped' }, USER),
         call({ orderId: 'o1' })
      )

      expect(response.status).toBe(409)
   })

   it('PATCH answers 404 for a missing order', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null)

      expect(
         (await orderPATCH(json({ shippingTrackingNumber: 'TRK-1' }, USER), call({ orderId: 'o1' }))).status
      ).toBe(404)
   })

   it('PATCH answers 500 on failure', async () => {
      prismaMock.order.findUnique.mockRejectedValue(new Error('down'))

      expect(
         (await orderPATCH(json({ shippingTrackingNumber: 'TRK-1' }, USER), call({ orderId: 'o1' }))).status
      ).toBe(500)
   })
})

describe('admin payments', () => {
   it('requires a session', async () => {
      expect((await paymentGET(get(), call({ paymentId: 'pay1' }))).status).toBe(401)
      expect((await paymentPATCH(json({}), call({ paymentId: 'pay1' }))).status).toBe(401)
   })

   it('GET returns the payment or 404', async () => {
      prismaMock.payment.findUnique.mockResolvedValue({ id: 'pay1' })
      expect((await paymentGET(get(USER), call({ paymentId: 'pay1' }))).status).toBe(200)

      prismaMock.payment.findUnique.mockResolvedValue(null)
      expect((await paymentGET(get(USER), call({ paymentId: 'x' }))).status).toBe(404)
   })

   it('GET answers 500 on failure', async () => {
      prismaMock.payment.findUnique.mockRejectedValue(new Error('down'))

      expect((await paymentGET(get(USER), call({ paymentId: 'pay1' }))).status).toBe(500)
   })

   it('PATCH strips gateway evidence from the body', async () => {
      prismaMock.payment.findUnique.mockResolvedValue({ id: 'pay1' })
      prismaMock.payment.update.mockResolvedValue({ id: 'pay1' })

      await paymentPATCH(
         json({ status: 'Paid', refId: 'forged', cardHash: 'x' }, USER),
         call({ paymentId: 'pay1' })
      )

      /* Unknown keys never reach the update: zod strips them. */
      expect(prismaMock.payment.update).toHaveBeenCalledWith({
         where: { id: 'pay1' },
         data: { status: 'Paid' },
      })
   })

   it('PATCH rejects an out-of-range fee and an empty body', async () => {
      expect(
         (
            await paymentPATCH(
               json({ fee: 99_000_000 }, USER),
               call({ paymentId: 'pay1' })
            )
         ).status
      ).toBe(400)
      expect((await paymentPATCH(json({}, USER), call({ paymentId: 'pay1' }))).status).toBe(400)
   })

   it('PATCH updates settlement fields', async () => {
      prismaMock.payment.findUnique.mockResolvedValue({ id: 'pay1' })
      prismaMock.payment.update.mockResolvedValue({ id: 'pay1', status: 'Paid' })

      const response = await paymentPATCH(
         json({ status: 'Paid', isSuccessful: true, fee: '5' }, USER),
         call({ paymentId: 'pay1' })
      )

      expect(response.status).toBe(200)
      expect(prismaMock.payment.update).toHaveBeenCalledWith({
         where: { id: 'pay1' },
         data: { status: 'Paid', isSuccessful: true, fee: 5 },
      })
   })

   it('PATCH answers 404 when the payment is gone', async () => {
      prismaMock.payment.findUnique.mockResolvedValue(null)

      expect(
         (await paymentPATCH(json({ status: 'Paid' }, USER), call({ paymentId: 'x' }))).status
      ).toBe(404)
   })

   it('PATCH answers 500 on failure', async () => {
      prismaMock.payment.findUnique.mockRejectedValue(new Error('down'))

      expect(
         (await paymentPATCH(json({ status: 'Paid' }, USER), call({ paymentId: 'pay1' }))).status
      ).toBe(500)
   })
})

describe('admin users', () => {
   it('requires a session', async () => {
      expect((await userGET(get(), call({ userId: 'u1' }))).status).toBe(401)
      expect((await userPATCH(json({}), call({ userId: 'u1' }))).status).toBe(401)
      expect((await userDEL(get(), call({ userId: 'u1' }))).status).toBe(401)
   })

   it('GET never selects the OTP or tokens', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' })

      await userGET(get(USER), call({ userId: 'u1' }))

      const [[args]] = prismaMock.user.findUnique.mock.calls as unknown as [
         [{ select: Record<string, boolean> }],
      ]

      expect(args.select).not.toHaveProperty('OTP')
      expect(args.select).not.toHaveProperty('emailUnsubscribeToken')
   })

   it('GET answers 404 for a missing user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      expect((await userGET(get(USER), call({ userId: 'x' }))).status).toBe(404)
   })

   it('GET answers 500 on failure', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('down'))

      expect((await userGET(get(USER), call({ userId: 'u1' }))).status).toBe(500)
   })

   it('PATCH validates the payload', async () => {
      expect(
         (await userPATCH(json({ email: 'not-an-email' }, USER), call({ userId: 'u1' }))).status
      ).toBe(400)
      expect((await userPATCH(json({}, USER), call({ userId: 'u1' }))).status).toBe(400)
   })

   it('PATCH updates an existing user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' })
      prismaMock.user.update.mockResolvedValue({ id: 'u1', name: 'Ada' })

      const response = await userPATCH(json({ name: 'Ada' }, USER), call({ userId: 'u1' }))

      expect(response.status).toBe(200)
   })

   it('PATCH answers 404 for a missing user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      expect(
         (await userPATCH(json({ name: 'Ada' }, USER), call({ userId: 'x' }))).status
      ).toBe(404)
   })

   it('PATCH maps a unique-constraint violation to 409', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' })
      prismaMock.user.update.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))

      const response = await userPATCH(json({ email: 'a@b.co' }, USER), call({ userId: 'u1' }))

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toMatchObject({
         message: 'EMAIL OR PHONE ALREADY IN USE',
      })
   })

   it('PATCH answers 500 for anything else', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' })
      prismaMock.user.update.mockRejectedValue(new Error('down'))

      expect(
         (await userPATCH(json({ name: 'Ada' }, USER), call({ userId: 'u1' }))).status
      ).toBe(500)
   })

   it('PATCH answers 500 for a non-object rejection', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' })
      prismaMock.user.update.mockRejectedValue(null)

      expect(
         (await userPATCH(json({ name: 'Ada' }, USER), call({ userId: 'u1' }))).status
      ).toBe(500)
   })

   it('DELETE answers 404 for a missing user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      expect((await userDEL(get(USER), call({ userId: 'x' }))).status).toBe(404)
   })

   it('DELETE refuses to erase a customer with orders', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' })
      prismaMock.order.count.mockResolvedValue(2)

      const response = await userDEL(get(USER), call({ userId: 'u1' }))

      expect(response.status).toBe(409)
      expect(prismaMock.user.delete).not.toHaveBeenCalled()
   })

   it('DELETE removes a customer with no orders', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' })
      prismaMock.order.count.mockResolvedValue(0)
      prismaMock.user.delete.mockResolvedValue({ id: 'u1' })

      const response = await userDEL(get(USER), call({ userId: 'u1' }))

      expect(response.status).toBe(200)
   })

   it('DELETE answers 500 on failure', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('down'))

      expect((await userDEL(get(USER), call({ userId: 'u1' }))).status).toBe(500)
   })
})
