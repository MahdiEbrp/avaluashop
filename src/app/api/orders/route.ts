import type { Prisma } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import { calculateDiscountedSubtotal, calculateOrderTotals, quoteShipping } from '@/lib/shipping'
import { NextResponse } from 'next/server'

type Tx = Prisma.TransactionClient

interface OrderBody {
   addressId?: unknown
   discountCode?: unknown
   shippingMethodId?: unknown
   idempotencyKey?: unknown
}

interface Coupon { id: string; percent: number; maxDiscountAmount: number }

interface CartLine {
   productId: string
   count: number
   product: { price: number; discount: number; isAvailable: boolean; stock: number }
}

interface ResolvedShippingMethod {
   id: string
   title: string
   type: 'FlatRate' | 'Free' | 'FreeAbove' | 'CarrierCalculated'
   amount: number
   freeAbove: number | null
   allowedCities: string[]
   carrierId: string | null
   carrier: { title: string } | null
}

interface ResolvedShipping { shippingMethod: ResolvedShippingMethod | null; shippingAmount: number }

const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/

/* Errors thrown inside the order transaction map to a fixed client response. */
const orderErrorResponses = new Map<string, () => NextResponse>([
   [
      'INSUFFICIENT_STOCK',
      () => new NextResponse('One or more products no longer have enough stock', { status: 409 }),
   ],
   [
      'INVALID_DISCOUNT_CODE',
      () => new NextResponse('Discount code is invalid or expired', { status: 400 }),
   ],
   [
      'SHIPPING_METHOD_REQUIRED',
      () => NextResponse.json({ message: 'SHIPPING_METHOD_REQUIRED' }, { status: 400 }),
   ],
   [
      'SHIPPING_METHOD_UNAVAILABLE',
      () => NextResponse.json({ message: 'SHIPPING_METHOD_UNAVAILABLE' }, { status: 409 }),
   ],
   [
      'SHIPPING_NOT_AVAILABLE_FOR_CITY',
      () => NextResponse.json({ message: 'SHIPPING_NOT_AVAILABLE_FOR_CITY' }, { status: 409 }),
   ],
])

export async function GET(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')
      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const orders = await prisma.order.findMany({
         where: { userId },
         select: {
            id: true,
            number: true,
            createdAt: true,
            payable: true,
            isPaid: true,
         },
         orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json(orders, { headers: { 'Cache-Control': 'private, no-store' } })
   } catch (error) {
      console.error('[ORDERS_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

function invalidOrderRequest() {
   return NextResponse.json({ message: 'INVALID_ORDER_REQUEST' }, { status: 400 })
}

async function readOrderBody(req: Request): Promise<OrderBody | null> {
   let body: unknown
   try {
      body = await req.json()
   } catch {
      return null
   }
   if (!body || typeof body !== 'object' || Array.isArray(body)) return null
   return body
}

function findOrderByIdempotencyKey(userId: string, idempotencyKey: string) {
   return prisma.order.findFirst({
      where: { userId, idempotencyKey },
   })
}

function isUnavailableCartLine(item: CartLine) {
   return (
      !Number.isInteger(item.count) ||
      item.count < 1 ||
      !item.product.isAvailable ||
      item.product.stock < item.count
   )
}

/* Coupon redemption counts as a stock decrement, so it is reserved inside the
   same transaction as the inventory it prices. */
async function reserveCoupon(tx: Tx, discountCode: string, now: Date): Promise<Coupon | null> {
   if (!discountCode) return null

   const coupon = await tx.discountCode.findFirst({
      where: {
         code: discountCode,
         stock: { gte: 1 },
         startDate: { lte: now },
         endDate: { gte: now },
      },
      select: { id: true, percent: true, maxDiscountAmount: true },
   })
   if (!coupon) throw new Error('INVALID_DISCOUNT_CODE')

   const reservedCoupon = await tx.discountCode.updateMany({
      where: {
         id: coupon.id,
         stock: { gte: 1 },
         startDate: { lte: now },
         endDate: { gte: now },
      },
      data: { stock: { decrement: 1 } },
   })
   if (reservedCoupon.count !== 1) throw new Error('INVALID_DISCOUNT_CODE')

   return coupon
}

async function reserveInventory(tx: Tx, items: CartLine[]) {
   for (const item of items) {
      const updated = await tx.product.updateMany({
         where: {
            id: item.productId,
            isAvailable: true,
            stock: { gte: item.count },
         },
         data: { stock: { decrement: item.count } },
      })
      if (updated.count !== 1) throw new Error('INSUFFICIENT_STOCK')
   }
}

/* Distinguish "you forgot to pick one" from "we do not deliver to this city",
   which is a dead end the customer must be told about. */
async function shippingSelectionError(tx: Tx, city: string) {
   const candidates = await tx.shippingMethod.findMany({
      where: { isActive: true, type: { not: 'CarrierCalculated' } },
      select: { type: true, amount: true, freeAbove: true, allowedCities: true },
   })
   const deliverable = candidates.some(
      (candidate) => quoteShipping(candidate, city, 0).available
   )
   return new Error(deliverable ? 'SHIPPING_METHOD_REQUIRED' : 'SHIPPING_NOT_AVAILABLE_FOR_CITY')
}

async function resolveShipping(
   tx: Tx,
   input: {
      activeMethodCount: number
      shippingMethodId: string | null
      city: string
      items: CartLine[]
      coupon: Coupon | null
   }
): Promise<ResolvedShipping> {
   /* Only methods that can actually be priced count: a carrier-calculated row
      has no quote yet, so counting it would block every order. */
   if (!input.shippingMethodId) {
      if (input.activeMethodCount > 0) {
         throw await shippingSelectionError(tx, input.city)
      }
      return { shippingMethod: null, shippingAmount: 0 }
   }

   const shippingMethod = await tx.shippingMethod.findFirst({
      where: { id: input.shippingMethodId, isActive: true },
      include: { carrier: { select: { title: true } } },
   })
   if (!shippingMethod) throw new Error('SHIPPING_METHOD_UNAVAILABLE')

   const discountedSubtotal = calculateDiscountedSubtotal(input.items, input.coupon)
   const quote = quoteShipping(
      shippingMethod,
      input.city,
      discountedSubtotal.subtotalAfterDiscount
   )
   if (!quote.available) throw new Error('SHIPPING_METHOD_UNAVAILABLE')

   return { shippingMethod, shippingAmount: quote.amount }
}

interface OrderInput {
   userId: string
   idempotencyKey: string | null
   addressId: string
   city: string
   discountCode: string
   shippingMethodId: string | null
   items: CartLine[]
   now: Date
}

/* Inventory, coupon usage, shipping quote and order totals are committed atomically. */
async function createOrderInTransaction(tx: Tx, input: OrderInput) {
   const coupon = await reserveCoupon(tx, input.discountCode, input.now)
   await reserveInventory(tx, input.items)

   const activeMethodCount = await tx.shippingMethod.count({
      where: { isActive: true, type: { not: 'CarrierCalculated' } },
   })
   const { shippingMethod, shippingAmount } = await resolveShipping(tx, {
      activeMethodCount,
      shippingMethodId: input.shippingMethodId,
      city: input.city,
      items: input.items,
      coupon,
   })

   const store = await tx.storeSetting.findUnique({
      where: { id: 'default' },
      select: { taxEnabled: true, taxRate: true },
   })
   const costs = calculateOrderTotals(
      input.items,
      coupon,
      { enabled: store?.taxEnabled ?? true, rate: store?.taxRate ?? 0.09 },
      shippingAmount
   )

   return tx.order.create({
      data: {
         userId: input.userId,
         idempotencyKey: input.idempotencyKey ?? undefined,
         status: 'PendingPayment',
         total: costs.total,
         tax: costs.tax,
         taxRateSnapshot: costs.taxRateSnapshot,
         payable: costs.payable,
         discount: costs.discount,
         shipping: costs.shipping,
         shippingMethodId: shippingMethod?.id,
         shippingMethodName: shippingMethod?.title,
         shippingCarrierId: shippingMethod?.carrierId,
         shippingCarrierName: shippingMethod?.carrier?.title,
         discountCodeId: coupon?.id,
         addressId: input.addressId,
         orderItems: {
            create: input.items.map((item) => ({
               count: item.count,
               price: item.product.price,
               discount: item.product.discount,
               productId: item.productId,
            })),
         },
      },
   })
}

interface CheckoutRequest {
   addressId: string
   city: string
   discountCode: string
   shippingMethodId: string | null
   items: CartLine[]
}

/* Validates everything the customer submitted before any inventory is touched. */
async function loadCheckoutRequest(userId: string, body: OrderBody): Promise<CheckoutRequest | NextResponse> {
   const addressId = typeof body.addressId === 'string' ? body.addressId : null
   if (!addressId) {
      return new NextResponse('A valid shipping address is required', { status: 400 })
   }

   const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true, city: true },
   })
   if (!address) return new NextResponse('Shipping address not found', { status: 404 })

   const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
   })
   if (!cart?.items?.length) {
      return new NextResponse('Your cart is empty', { status: 400 })
   }
   if (cart.items.some((item) => isUnavailableCartLine(item))) {
      return new NextResponse('One or more products are unavailable or have insufficient stock', {
         status: 409,
      })
   }

   return {
      addressId,
      city: address.city,
      discountCode: typeof body.discountCode === 'string' ? body.discountCode.trim() : '',
      shippingMethodId: typeof body.shippingMethodId === 'string' ? body.shippingMethodId : null,
      items: cart.items,
   }
}

function isUniqueViolation(error: unknown) {
   return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function orderErrorResponse(error: unknown): NextResponse {
   if (error instanceof Error) {
      const respond = orderErrorResponses.get(error.message)
      if (respond) return respond()
   }
   console.error('[ORDERS_POST]', error)
   return new NextResponse('Internal error', { status: 500 })
}

export async function POST(req: Request) {
   let requestUserId: string | null = null
   let requestKey: string | null = null
   try {
      const userId = req.headers.get('X-USER-ID')
      requestUserId = userId
      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const body = await readOrderBody(req)
      if (!body) return invalidOrderRequest()

      const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null
      if (idempotencyKey !== null && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
         return invalidOrderRequest()
      }
      requestKey = idempotencyKey

      // A retry with the same key returns its original order before reserving
      // inventory or consuming a discount code again.
      if (idempotencyKey) {
         const existingOrder = await findOrderByIdempotencyKey(userId, idempotencyKey)
         if (existingOrder) return NextResponse.json(existingOrder, { status: 200 })
      }

      const checkout = await loadCheckoutRequest(userId, body)
      if (checkout instanceof NextResponse) return checkout

      const order = await prisma.$transaction((tx) =>
         createOrderInTransaction(tx, {
            userId,
            idempotencyKey,
            ...checkout,
            now: new Date(),
         })
      )

      // Keep the cart until payment is verified by Tabapay.
      return NextResponse.json(order, { status: 201 })
   } catch (error) {
      // A concurrent request may win the unique-key race after both requests
      // passed the initial lookup. The losing transaction rolls back all
      // inventory/coupon changes; return the winner's committed order.
      const raced =
         requestUserId && requestKey && isUniqueViolation(error)
            ? await findOrderByIdempotencyKey(requestUserId, requestKey)
            : null
      if (raced) return NextResponse.json(raced, { status: 200 })
      return orderErrorResponse(error)
   }
}
