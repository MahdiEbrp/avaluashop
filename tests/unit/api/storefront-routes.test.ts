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
         { count: 2, productId: 'p1', product: { price: 100, discount: 5 } },
         { count: 1, productId: 'p2', product: { price: 50, discount: 0 } },
      ],
   }

   const stubSuccess = () => {
      prismaMock.cart.findUniqueOrThrow.mockResolvedValue(cart)
      prismaMock.order.create.mockResolvedValue({ id: 'o1', number: 42 })
      prismaMock.owner.findMany.mockResolvedValue([{ id: 'own1', email: 'o@b.co' }])
      prismaMock.notification.createMany.mockResolvedValue({ count: 1 })
   }

   it('rejects an anonymous caller', async () => {
      expect((await ordersPOST(json({ addressId: 'ad1' }))).status).toBe(401)
   })

   it('creates the order with computed totals and notifies the owners', async () => {
      stubSuccess()

      const response = await ordersPOST(json({ addressId: 'ad1' }, USER))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ id: 'o1', number: 42 })

      /* total 250, discount 10, tax 9% of 240 = 21.6, payable 261.6 */
      expect(prismaMock.order.create).toHaveBeenCalledWith({
         data: expect.objectContaining({
            status: 'Processing',
            total: 250,
            discount: 10,
            tax: 21.6,
            payable: 261.6,
            shipping: 0,
         }),
      })
      expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
         data: [
            {
               userId: 'own1',
               content: 'Order #42 was created was created with a value of $261.6.',
            },
         ],
      })
   })

   it('checks a discount code when one is supplied', async () => {
      stubSuccess()

      await ordersPOST(json({ addressId: 'ad1', discountCode: 'SAVE10' }, USER))

      expect(prismaMock.discountCode.findUniqueOrThrow).toHaveBeenCalledWith({
         where: { code: 'SAVE10', stock: { gte: 1 } },
      })
   })

   it('still succeeds when owner mail delivery fails', async () => {
      stubSuccess()
      const { sendMail } = await import('@persepolis/mail')
      vi.mocked(sendMail).mockRejectedValueOnce(new Error('smtp down'))

      const response = await ordersPOST(json({ addressId: 'ad1' }, USER))

      expect(response.status).toBe(200)
   })

   it('answers 500 when the cart is empty or missing', async () => {
      prismaMock.cart.findUniqueOrThrow.mockRejectedValue(new Error('P2025'))

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
