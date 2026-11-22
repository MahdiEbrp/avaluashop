import { releasePendingOrder } from '@/lib/payments/order-lifecycle'
import prisma from '@/lib/prisma'

export const DEFAULT_PENDING_ORDER_EXPIRY_MINUTES = 30
export const MIN_PENDING_ORDER_EXPIRY_MINUTES = 5
export const MAX_PENDING_ORDER_EXPIRY_MINUTES = 1440
export const DEFAULT_RECONCILE_BATCH_SIZE = 50
export const MAX_RECONCILE_BATCH_SIZE = 100

export interface ReconcilePendingOrdersOptions {
   now?: Date
   expiryMinutes?: number
   limit?: number
}

export interface ReconcilePendingOrdersResult {
   cutoffIso: string
   scannedCount: number
   releasedOrderIds: string[]
   skippedPaidOrderIds: string[]
   manualReconciliationOrderIds: string[]
}

function clampInteger(
   value: number | undefined,
   fallback: number,
   min: number,
   max: number
): number {
   if (value === undefined) return fallback
   if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error('INVALID_RECONCILE_OPTIONS')
   }
   return value
}

/**
 * Releases expired `PendingPayment` orders only when their payments are proven
 * never to have reached the gateway (no payment row, only failed/denied rows,
 * or a stale local `pending:` initialization marker). Orders with a real
 * provider token are left reserved and reported for manual reconciliation.
 */
export async function reconcilePendingOrders(
   options: ReconcilePendingOrdersOptions = {}
): Promise<ReconcilePendingOrdersResult> {
   const expiryMinutes = clampInteger(
      options.expiryMinutes,
      DEFAULT_PENDING_ORDER_EXPIRY_MINUTES,
      MIN_PENDING_ORDER_EXPIRY_MINUTES,
      MAX_PENDING_ORDER_EXPIRY_MINUTES
   )
   const limit = clampInteger(
      options.limit,
      DEFAULT_RECONCILE_BATCH_SIZE,
      1,
      MAX_RECONCILE_BATCH_SIZE
   )
   const now = options.now ?? new Date()
   const cutoff = new Date(now.getTime() - expiryMinutes * 60_000)

   const pendingOrders = await prisma.order.findMany({
      where: {
         status: 'PendingPayment',
         createdAt: { lte: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
         id: true,
         isPaid: true,
         payments: {
            select: {
               id: true,
               status: true,
               isSuccessful: true,
               refId: true,
            },
         },
      },
   })

   const releasedOrderIds: string[] = []
   const skippedPaidOrderIds: string[] = []
   const manualReconciliationOrderIds: string[] = []

   for (const order of pendingOrders) {
      const hasPaidEvidence =
         order.isPaid ||
         order.payments.some(
            (payment) => payment.isSuccessful || payment.status === 'Paid'
         )
      if (hasPaidEvidence) {
         skippedPaidOrderIds.push(order.id)
         continue
      }

      const hasProviderTokenInFlight = order.payments.some(
         (payment) =>
            payment.status === 'Processing' &&
            !payment.refId.startsWith('pending:')
      )
      if (hasProviderTokenInFlight) {
         manualReconciliationOrderIds.push(order.id)
         continue
      }

      const staleLocalPayment = order.payments.find(
         (payment) => payment.status === 'Processing'
      )
      const released = await releasePendingOrder(order.id, staleLocalPayment?.id)
      if (released) {
         releasedOrderIds.push(order.id)
      }
   }

   return {
      cutoffIso: cutoff.toISOString(),
      scannedCount: pendingOrders.length,
      releasedOrderIds,
      skippedPaidOrderIds,
      manualReconciliationOrderIds,
   }
}
