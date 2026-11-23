/**
 * Shared, typed doubles for everything a unit test must not touch for real:
 * the database, the network, cookies, navigation and the Next router cache.
 *
 * The Prisma double is intentionally hand-written instead of `vi.mock`-heavy:
 * tree-shaken modules run in isolated module graphs, so a stub passed through a
 * global registry is the only reliable way to reach them.
 */
import type { Mock } from 'vitest'

export type MockFn = Mock

/* ------------------------------------------------------------------ *
 * database
 * ------------------------------------------------------------------ */

type TableMock = Record<string, MockFn>

export interface PrismaMock {
   user: TableMock
   cart: TableMock
   cartItem: TableMock
   product: TableMock
   order: TableMock
   orderItem: TableMock
   payment: TableMock
   address: TableMock
   banner: TableMock
   brand: TableMock
   category: TableMock
   blog: TableMock
   discountCode: TableMock
   refund: TableMock
   notification: TableMock
   productReview: TableMock
   error: TableMock
   file: TableMock
   owner: TableMock
   author: TableMock
   provider: TableMock
   paymentProvider: TableMock
   storeSetting: TableMock
   shippingMethod: TableMock
   shippingCarrier: TableMock
   $queryRaw: MockFn
   $transaction: MockFn
   $connect: MockFn
   $disconnect: MockFn
}

const TABLES = [
   'user',
   'cart',
   'cartItem',
   'product',
   'order',
   'orderItem',
   'payment',
   'address',
   'banner',
   'brand',
   'category',
   'blog',
   'discountCode',
   'refund',
   'notification',
   'productReview',
   'error',
   'file',
   'owner',
   'author',
   'provider',
   'paymentProvider',
   'storeSetting',
   'shippingMethod',
   'shippingCarrier',
]

const CRUD = [
   'findMany',
   'findUnique',
   'findUniqueOrThrow',
   'findFirst',
   'findFirstOrThrow',
   'create',
   'createMany',
   'update',
   'updateMany',
   'upsert',
   'delete',
   'deleteMany',
   'count',
   'aggregate',
   'groupBy',
]

export function createPrismaMock(): PrismaMock {
   const mock = {
      $queryRaw: vi.fn(() => Promise.resolve([{ '?column?': 1 }])),
      $connect: vi.fn(() => {return Promise.resolve(); }),
      $disconnect: vi.fn(() => {return Promise.resolve(); }),
   } as PrismaMock

   mock.$transaction = vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') return await (arg as (tx: unknown) => unknown)(mock)

      if (Array.isArray(arg)) return await Promise.all(arg)

   })

   for (const table of TABLES) {
      const delegate: TableMock = {}

      for (const method of CRUD) {
         delegate[method] = vi.fn(() => {
            if (method === 'findMany') return Promise.resolve([])
            if (method.startsWith('find')) return Promise.resolve(null)
            if (method === 'count') return Promise.resolve(0)
            return Promise.resolve(null)
         })
      }

      mock[table as keyof PrismaMock] = delegate as never
   }

   return mock
}

/* The registry survives isolated module graphs within one worker. */
const registry = globalThis as unknown as { __prismaMock?: PrismaMock }

export const prismaMock: PrismaMock =
   registry.__prismaMock ?? (registry.__prismaMock = createPrismaMock())

/** Re-arm every delegate between tests without losing the registry identity. */
export function resetPrismaMock() {
   for (const table of TABLES) {
      const delegate = prismaMock[table as keyof PrismaMock] as TableMock

      for (const method of CRUD) delegate[method].mockReset()

      for (const method of CRUD) {
         delegate[method].mockImplementation(() => {
            if (method === 'findMany') return Promise.resolve([])
            if (method.startsWith('find')) return Promise.resolve(null)
            if (method === 'count') return Promise.resolve(0)
            return Promise.resolve(null)
         })
      }
   }

   prismaMock.$queryRaw.mockReset()
   prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
   prismaMock.$transaction.mockReset()
   prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function')
         return await (arg as (tx: unknown) => unknown)(prismaMock)
      if (Array.isArray(arg)) return await Promise.all(arg)
   })
}

/** Async factory used by `vi.mock('@/lib/prisma')` in every test file. */
export function prismaModule() {
   return Promise.resolve({ default: prismaMock })
}
