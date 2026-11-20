import { GET as healthGET } from '@/app/api/health/route'
import { GET as productsGET } from '@/app/api/products/route'
import { GET as productGET } from '@/app/api/products/[productId]/route'
import { GET as cartGET, POST as cartPOST } from '@/app/api/cart/route'
import { GET as ordersGET, POST as ordersPOST } from '@/app/api/orders/route'
import { GET as orderGET } from '@/app/api/orders/[orderId]/route'
import { call, get, json, prismaMock, silenceConsole, USER, bodyOf } from './helpers'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

const cachedProducts = vi.fn(async () => '[]')

vi.mock('@/lib/catalog', async () => {
   const actual = await vi.importActual<typeof import('@/lib/catalog')>('@/lib/catalog')

   return { ...actual, getProductsJson: () => cachedProducts() }
})

beforeEach(() => silenceConsole())

describe('GET /api/health', () => {
   it('reports reachable with no cache headers', async () => {
      const response = await healthGET()

      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store')
      await expect(response.json()).resolves.toMatchObject({
         status: 'success',
         database: 'reachable',
      })
   })

   it('answers 503 when the database is unreachable', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('down'))

      const response = await healthGET()

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({
         status: 'fail',
         database: 'unreachable',
      })
   })
})

describe('GET /api/products', () => {
   it('serves the cached payload as private JSON', async () => {
      cachedProducts.mockResolvedValueOnce('[{"id":"p1"}]')

      const response = await productsGET()

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/json')
      expect(response.headers.get('cache-control')).toBe(
         'private, max-age=0, must-revalidate'
      )
      await expect(response.text()).resolves.toBe('[{"id":"p1"}]')
   })

   it('answers 500 when the cache read fails', async () => {
      cachedProducts.mockRejectedValueOnce(new Error('boom'))

      const response = await productsGET()

      expect(response.status).toBe(500)
      await expect(response.text()).resolves.toBe('Internal error')
   })
})

describe('GET /api/products/[productId]', () => {
   it('rejects an empty id', async () => {
      const response = await productGET(get(), call({ productId: '' }))

      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Product id is required')
   })

   it('returns the product with its relations', async () => {
      prismaMock.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1' })

      const response = await productGET(get(), call({ productId: 'p1' }))

      await expect(response.json()).resolves.toEqual({ id: 'p1' })
      expect(prismaMock.product.findUniqueOrThrow).toHaveBeenCalledWith({
         where: { id: 'p1' },
         include: { categories: true, brand: true },
      })
   })

   it('answers 500 for a missing product', async () => {
      prismaMock.product.findUniqueOrThrow.mockRejectedValue(new Error('P2025'))

      expect((await productGET(get(), call({ productId: 'x' }))).status).toBe(500)
   })
})

describe('/api/cart', () => {
   it('GET rejects an anonymous caller', async () => {
      const response = await cartGET(get())

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toMatchObject({
         message: 'UNAUTHORIZED',
      })
   })

   it('GET returns the cart', async () => {
      prismaMock.cart.findUnique.mockResolvedValue({ userId: 'user-1', items: [] })

      const response = await cartGET(get(USER))

      await expect(response.json()).resolves.toEqual({ userId: 'user-1', items: [] })
   })

   it('GET synthesises an empty cart for a first-time visitor', async () => {
      prismaMock.cart.findUnique.mockResolvedValue(null)

      const response = await cartGET(get(USER))

      await expect(response.json()).resolves.toEqual({ userId: 'user-1', items: [] })
   })

   it('GET answers 500 on a database failure', async () => {
      prismaMock.cart.findUnique.mockRejectedValue(new Error('down'))

      expect((await cartGET(get(USER))).status).toBe(500)
   })

   it('POST rejects an anonymous caller', async () => {
      expect((await cartPOST(json({ productId: 'p1', count: 1 }))).status).toBe(401)
   })

   it('POST rejects a malformed line with 400', async () => {
      const response = await cartPOST(json({ productId: '', count: -1 }, USER))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ message: 'INVALID CART LINE' })
   })

   it('POST removes the line when count is zero', async () => {
      prismaMock.cartItem.deleteMany.mockResolvedValue({ count: 1 })
      prismaMock.cart.findUnique.mockResolvedValue({ userId: 'user-1', items: [] })

      const response = await cartPOST(json({ productId: 'p1', count: 0 }, USER))

      expect(response.status).toBe(200)
      expect(prismaMock.cartItem.deleteMany).toHaveBeenCalledWith({
         where: { cartId: 'user-1', productId: 'p1' },
      })
      expect(prismaMock.cart.upsert).not.toHaveBeenCalled()
   })

   it('POST answers 404 for an unbuyable product', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null)

      const response = await cartPOST(json({ productId: 'p1', count: 2 }, USER))

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toMatchObject({
         message: 'PRODUCT NOT AVAILABLE',
      })
   })

   it('POST upserts the line and returns the refreshed cart', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 'p1' })
      prismaMock.cart.upsert.mockResolvedValue({})
      prismaMock.cart.findUnique.mockResolvedValue({
         userId: 'user-1',
         items: [{ product: { id: 'p1' }, count: 2 }],
      })

      const response = await cartPOST(json({ productId: 'p1', count: 2 }, USER))
      const body = await bodyOf(response)

      expect(response.status).toBe(200)
      expect(body).toMatchObject({ userId: 'user-1' })
      expect(prismaMock.cart.upsert).toHaveBeenCalledWith({
         where: { userId: 'user-1' },
         create: {
            user: { connect: { id: 'user-1' } },
            items: { create: { productId: 'p1', count: 2 } },
         },
         update: {
            items: {
               upsert: {
                  where: { UniqueCartItem: { cartId: 'user-1', productId: 'p1' } },
                  update: { count: 2 },
                  create: { productId: 'p1', count: 2 },
               },
            },
         },
      })
   })

   it('POST returns an empty cart shape when the reload finds nothing', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 'p1' })
      prismaMock.cart.findUnique.mockResolvedValue(null)

      const response = await cartPOST(json({ productId: 'p1', count: 1 }, USER))

      await expect(response.json()).resolves.toEqual({ userId: 'user-1', items: [] })
   })

   it('POST answers 500 on a database failure', async () => {
      prismaMock.product.findFirst.mockRejectedValue(new Error('down'))

      expect((await cartPOST(json({ productId: 'p1', count: 1 }, USER))).status).toBe(500)
   })
})

describe('GET /api/orders', () => {
   it('rejects an anonymous caller', async () => {
      expect((await ordersGET(get())).status).toBe(401)
   })

   it('lists the caller orders with relations', async () => {
      prismaMock.order.findMany.mockResolvedValue([{ id: 'o1' }])

      const response = await ordersGET(get(USER))

      await expect(response.json()).resolves.toEqual([{ id: 'o1' }])
      expect(prismaMock.order.findMany).toHaveBeenCalledWith({
         where: { userId: 'user-1' },
         include: { address: true, payments: true, refund: true, orderItems: true },
      })
   })

   it('answers 500 on a database failure', async () => {
      prismaMock.order.findMany.mockRejectedValue(new Error('down'))

      expect((await ordersGET(get(USER))).status).toBe(500)
   })
})

describe('POST /api/orders', () => {
   const cart = {
      items: [
         {
            count: 2,
            productId: 'p1',
            product: { price: 100, discount: 5, stock: 10, isAvailable: true },
         },
         {
            count: 1,
            productId: 'p2',
            product: { price: 50, discount: 0, stock: 3, isAvailable: true },
         },
      ],
   }

   /* Every request now has to clear the address-ownership gate first. */
   const stubSuccess = () => {
      prismaMock.address.findFirst.mockResolvedValue({ id: 'ad1' })
      prismaMock.cart.findUnique.mockResolvedValue(cart)
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 })
      prismaMock.order.create.mockResolvedValue({ id: 'o1', number: 42 })
   }

   it('rejects an anonymous caller', async () => {
      expect((await ordersPOST(json({ addressId: 'ad1' }))).status).toBe(401)
   })

   it('requires a shipping address', async () => {
      const response = await ordersPOST(json({}, USER))

      expect(response.status).toBe(400)
      await expect(response.text()).resolves.toBe('A valid shipping address is required')
   })

   it('refuses an address that belongs to another customer', async () => {
      prismaMock.address.findFirst.mockResolvedValue(null)

      const response = await ordersPOST(json({ addressId: 'someone-elses' }, USER))

      expect(response.status).toBe(404)
      await expect(response.text()).resolves.toBe('Shipping address not found')
      /* Ownership is part of the query, not a post-hoc check. */
      expect(prismaMock.address.findFirst).toHaveBeenCalledWith({
         where: { id: 'someone-elses', userId: 'user-1' },
         select: { id: true },
      })
      expect(prismaMock.order.create).not.toHaveBeenCalled()
   })

   it('creates a pending-payment order with server-computed totals', async () => {
      stubSuccess()

      const response = await ordersPOST(json({ addressId: 'ad1' }, USER))

      expect(response.status).toBe(201)
      await expect(response.json()).resolves.toEqual({ id: 'o1', number: 42 })

      /* total 250, discount 10, tax 9% of 240 = 21.6, payable 261.6 */
      expect(prismaMock.order.create).toHaveBeenCalledWith({
         data: expect.objectContaining({
            status: 'PendingPayment',
            total: 250,
            discount: 10,
            tax: 21.6,
            payable: 261.6,
            shipping: 0,
         }),
      })
      expect(prismaMock.notification.createMany).not.toHaveBeenCalled()
      expect(prismaMock.cartItem.deleteMany).not.toHaveBeenCalled()
   })

   it('reserves stock for every line inside the transaction', async () => {
      stubSuccess()

      await ordersPOST(json({ addressId: 'ad1' }, USER))

      expect(prismaMock.$transaction).toHaveBeenCalled()
      expect(prismaMock.product.updateMany).toHaveBeenCalledWith({
         where: { id: 'p1', isAvailable: true, stock: { gte: 2 } },
         data: { stock: { decrement: 2 } },
      })
      expect(prismaMock.product.updateMany).toHaveBeenCalledWith({
         where: { id: 'p2', isAvailable: true, stock: { gte: 1 } },
         data: { stock: { decrement: 1 } },
      })
   })

   it('answers 409 when stock changes between the read and the reservation', async () => {
      stubSuccess()
      prismaMock.product.updateMany.mockResolvedValue({ count: 0 })

      const response = await ordersPOST(json({ addressId: 'ad1' }, USER))

      expect(response.status).toBe(409)
      await expect(response.text()).resolves.toBe(
         'One or more products no longer have enough stock'
      )
      expect(prismaMock.order.create).not.toHaveBeenCalled()
   })

   it('answers 409 before writing when a line cannot be fulfilled', async () => {
      prismaMock.address.findFirst.mockResolvedValue({ id: 'ad1' })
      prismaMock.cart.findUnique.mockResolvedValue({
         items: [
            {
               count: 99,
               productId: 'p1',
               product: { price: 100, discount: 0, stock: 2, isAvailable: true },
            },
         ],
      })

      const response = await ordersPOST(json({ addressId: 'ad1' }, USER))

      expect(response.status).toBe(409)
      expect(prismaMock.$transaction).not.toHaveBeenCalled()
      expect(prismaMock.order.create).not.toHaveBeenCalled()
   })

   it('answers 409 for an unavailable product', async () => {
      prismaMock.address.findFirst.mockResolvedValue({ id: 'ad1' })
      prismaMock.cart.findUnique.mockResolvedValue({
         items: [
            {
               count: 1,
               productId: 'p1',
               product: { price: 100, discount: 0, stock: 5, isAvailable: false },
            },
         ],
      })

      expect((await ordersPOST(json({ addressId: 'ad1' }, USER))).status).toBe(409)
   })

   it('checks a discount code when one is supplied', async () => {
      stubSuccess()
      prismaMock.discountCode.findFirst.mockResolvedValue({ id: 'd1', percent: 10, maxDiscountAmount: 20 })
      prismaMock.discountCode.updateMany.mockResolvedValue({ count: 1 })

      await ordersPOST(json({ addressId: 'ad1', discountCode: 'SAVE10' }, USER))

      /* The lookup now pins the validity window as well as the remaining stock. */
      expect(prismaMock.discountCode.findFirst).toHaveBeenCalledWith({
         where: {
            code: 'SAVE10',
            stock: { gte: 1 },
            startDate: { lte: expect.any(Date) },
            endDate: { gte: expect.any(Date) },
         },
         select: { id: true, percent: true, maxDiscountAmount: true },
      })
      expect(prismaMock.discountCode.updateMany).toHaveBeenCalledWith({
         where: {
            id: 'd1',
            stock: { gte: 1 },
            startDate: { lte: expect.any(Date) },
            endDate: { gte: expect.any(Date) },
         },
         data: { stock: { decrement: 1 } },
      })
      expect(prismaMock.order.create).toHaveBeenCalledWith({
         data: expect.objectContaining({
            discountCodeId: 'd1',
            discount: 30,
            tax: 19.8,
            payable: 239.8,
         }),
      })
   })

   it('rejects an expired or unknown discount code', async () => {
      stubSuccess()
      prismaMock.discountCode.findFirst.mockResolvedValue(null)

      const response = await ordersPOST(
         json({ addressId: 'ad1', discountCode: 'OLD' }, USER)
      )

      expect(response.status).toBe(400)
      await expect(response.text()).resolves.toBe('Discount code is invalid or expired')
      expect(prismaMock.order.create).not.toHaveBeenCalled()
   })

   it('refuses the order when the coupon runs out mid-checkout', async () => {
      /* Two shoppers racing for the last use of a code: the conditional
         decrement matches no row, so the whole transaction must roll back
         rather than let the second shopper keep an unearned discount. */
      stubSuccess()
      prismaMock.discountCode.findFirst.mockResolvedValue({
         id: 'd1',
         percent: 10,
         maxDiscountAmount: 20,
      })
      prismaMock.discountCode.updateMany.mockResolvedValue({ count: 0 })

      const response = await ordersPOST(
         json({ addressId: 'ad1', discountCode: 'SAVE10' }, USER)
      )

      expect(response.status).toBe(400)
      await expect(response.text()).resolves.toBe('Discount code is invalid or expired')
      expect(prismaMock.order.create).not.toHaveBeenCalled()
      /* Stock reserved for the abandoned attempt must not leak. */
      expect(prismaMock.product.updateMany).not.toHaveBeenCalled()
   })

   it('awards a zero discount rather than failing when the coupon grants nothing', async () => {
      /* A coupon with a zero cap still has to produce a coherent order. */
      stubSuccess()
      prismaMock.discountCode.findFirst.mockResolvedValue({
         id: 'd1',
         percent: 50,
         maxDiscountAmount: 0,
      })
      prismaMock.discountCode.updateMany.mockResolvedValue({ count: 1 })

      const response = await ordersPOST(
         json({ addressId: 'ad1', discountCode: 'ZERO' }, USER)
      )

      expect(response.status).toBe(201)
      expect(prismaMock.order.create).toHaveBeenCalledWith({
         data: expect.objectContaining({
            discountCodeId: 'd1',
            discount: 10,
            tax: 21.6,
            payable: 261.6,
         }),
      })
   })

   it('keeps the cart intact until the payment callback is verified', async () => {
      stubSuccess()

      const response = await ordersPOST(json({ addressId: 'ad1' }, USER))

      expect(response.status).toBe(201)
      expect(prismaMock.cartItem.deleteMany).not.toHaveBeenCalled()
   })

   it('answers 400 when the cart is empty or missing', async () => {
      prismaMock.address.findFirst.mockResolvedValue({ id: 'ad1' })
      prismaMock.cart.findUnique.mockResolvedValue(null)

      const response = await ordersPOST(json({ addressId: 'ad1' }, USER))

      expect(response.status).toBe(400)
      await expect(response.text()).resolves.toBe('Your cart is empty')
   })

   it('answers 400 for a cart with no items', async () => {
      prismaMock.address.findFirst.mockResolvedValue({ id: 'ad1' })
      prismaMock.cart.findUnique.mockResolvedValue({ items: [] })

      expect((await ordersPOST(json({ addressId: 'ad1' }, USER))).status).toBe(400)
   })

   it('answers 500 on an unexpected database failure', async () => {
      prismaMock.address.findFirst.mockResolvedValue({ id: 'ad1' })
      prismaMock.cart.findUnique.mockRejectedValue(new Error('down'))

      const response = await ordersPOST(json({ addressId: 'ad1' }, USER))

      expect(response.status).toBe(500)
      await expect(response.text()).resolves.toBe('Internal error')
   })
})

describe('GET /api/orders/[orderId]', () => {
   it('rejects an anonymous caller', async () => {
      expect((await orderGET(get(), call({ orderId: 'o1' }))).status).toBe(401)
   })

   it('rejects an empty id', async () => {
      const response = await orderGET(get(USER), call({ orderId: '' }))

      expect(response.status).toBe(400)
      expect(await response.text()).toBe('orderId is required')
   })

   it('returns the order scoped to the caller', async () => {
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({ id: 'o1' })

      const response = await orderGET(get(USER), call({ orderId: 'o1' }))

      await expect(response.json()).resolves.toEqual({ id: 'o1' })
      expect(prismaMock.order.findUniqueOrThrow).toHaveBeenCalledWith(
         expect.objectContaining({ where: { userId: 'user-1', id: 'o1' } })
      )
   })

   it('answers 500 for an order that is not the caller', async () => {
      prismaMock.order.findUniqueOrThrow.mockRejectedValue(new Error('P2025'))

      expect((await orderGET(get(USER), call({ orderId: 'o9' }))).status).toBe(500)
   })
})
