import { vi } from 'vitest'

/** Outbound mail is recorded instead of delivered. */
export const sentMail: unknown[] = []

export const sendMail = vi.fn((message: unknown) => {
   sentMail.push(message)
   return Promise.resolve({ accepted: ['test@example.com'] })
})

const persepolisMail = { sendMail }

export default persepolisMail
