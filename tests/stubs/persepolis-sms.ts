import { vi } from 'vitest'

/** Outbound SMS is recorded instead of delivered. */
export const sentSms: unknown[] = []

export const sendTransactionalSMS = vi.fn(async (message: unknown) => {
   sentSms.push(message)
   return { status: 1 }
})

export const sendBulkSMS = sendTransactionalSMS
export const sendLikeToLikeSMS = sendTransactionalSMS
