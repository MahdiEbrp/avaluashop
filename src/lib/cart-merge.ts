import prisma from '@/lib/prisma'
import { z } from 'zod'

/**
 * Guest carts live in `localStorage` and are handed to the server exactly once,
 * on the OTP verify call that turns the guest into a signed-in user. That
 * payload is fully attacker-controlled, so nothing below trusts it:
 *
 *   - the shape is validated (a tampered `count: "DROP"` is dropped, not 500d)
 *   - at most `MAX_LINES` lines survive, so a 10 MB body cannot fan out
 *   - product ids are checked against the catalogue in a single query, so an
 *     unknown id can never trip a foreign-key error
 *   - every surviving line is written in ONE statement instead of N
 */
export const MAX_LINES = 50
export const MAX_COUNT = 99

const guestLine = z.object({
   productId: z.string().min(1).max(64),
   count: z.coerce.number().int().min(1).max(MAX_COUNT),
})

export interface CartLine {
   productId: string
   count: number
}

/**
 * Normalises an untrusted guest cart into at most `MAX_LINES` lines, summing
 * duplicate product ids and clamping the total per line to `MAX_COUNT`.
 * Anything that does not parse is discarded rather than rejected: a broken
 * localStorage entry must never block a login.
 */
export function parseGuestCart(raw: unknown): CartLine[] {
   const items = z
      .object({ items: z.array(z.unknown()).max(500).default([]) })
      .safeParse(raw)

   if (!items.success) return []

   const merged = new Map<string, number>()

   for (const item of items.data.items.slice(0, MAX_LINES * 4)) {
      const line = guestLine.safeParse(item)

      if (!line.success) continue

      const next = (merged.get(line.data.productId) ?? 0) + line.data.count

      merged.set(line.data.productId, Math.min(next, MAX_COUNT))
   }

   return [...merged]
      .slice(0, MAX_LINES)
      .map(([productId, count]) => ({ productId, count }))
}

/**
 * Folds the guest cart into the signed-in user's cart.
 *
 * Returns the number of lines actually written. Two queries total, whatever the
 * size of the incoming cart: one to keep only ids that exist and are buyable,
 * one to write the whole merge.
 */
export async function mergeGuestCart(
   userId: string,
   lines: CartLine[]
): Promise<number> {
   if (lines.length === 0) return 0

   const wanted = lines.map((line) => line.productId)

   const available = await prisma.product.findMany({
      where: { id: { in: wanted }, isAvailable: true },
      select: { id: true },
   })

   const buyable = new Set(available.map((product) => product.id))

   const writable = lines.filter((line) => buyable.has(line.productId))

   if (writable.length === 0) return 0

   await prisma.cart.upsert({
      where: { userId },
      create: {
         user: { connect: { id: userId } },
         items: { create: writable },
      },
      update: {
         items: {
            upsert: writable.map((line) => ({
               where: {
                  UniqueCartItem: { cartId: userId, productId: line.productId },
               },
               /* A merge adds up: two of a thing as a guest plus one already in
                  the account is three, not two. */
               update: { count: { increment: line.count } },
               create: { productId: line.productId, count: line.count },
            })),
         },
      },
   })

   return writable.length
}
