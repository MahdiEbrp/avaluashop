import { vi } from 'vitest'

/** Outbound SMS is recorded instead of delivered. */
export const sentSms: unknown[] = []

export const sendTransactionalSMS = vi.fn((message: unknown) => {
   sentSms.push(message)
   return Promise.resolve({ status: 1 })
})

export const sendBulkSMS = sendTransactionalSMS
export const sendLikeToLikeSMS = sendTransactionalSMS
