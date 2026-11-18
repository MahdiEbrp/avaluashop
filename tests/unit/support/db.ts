/**
 * Shared, typed doubles for everything a unit test must not touch for real:
 * the database, the network, cookies, navigation and the Next router cache.
 *
 * The Prisma double is intentionally hand-written instead of `vi.mock`-heavy:
 * tree-shaken modules run in isolated module graphs, so a stub passed through a
 * global registry is the only reliable way to reach them.
 */
import { vi } from 'vitest'

export type MockFn = ReturnType<typeof vi.fn>

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
      $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
      $connect: vi.fn(async () => undefined),
      $disconnect: vi.fn(async () => undefined),
   } as PrismaMock

   mock.$transaction = vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') return await (arg as (tx: unknown) => unknown)(mock)

      if (Array.isArray(arg)) return await Promise.all(arg)

      return undefined
   })

   for (const table of TABLES) {
      const delegate: TableMock = {}

      for (const method of CRUD) {
         delegate[method] = vi.fn(async () => {
            if (method.startsWith('find')) return null
            if (method === 'count') return 0
            return null
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
         delegate[method].mockImplementation(async () => {
            if (method.startsWith('find')) return null
            if (method === 'count') return 0
            return null
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
      return undefined
   })
}

/** Async factory used by `vi.mock('@/lib/prisma')` in every test file. */
export async function prismaModule() {
   return { default: prismaMock }
}
