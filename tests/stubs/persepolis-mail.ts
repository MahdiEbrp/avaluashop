import { vi } from 'vitest'

/** Outbound mail is recorded instead of delivered. */
export const sentMail: unknown[] = []

export const sendMail = vi.fn(async (message: unknown) => {
   sentMail.push(message)
   return { accepted: ['test@example.com'] }
})

export default { sendMail }
