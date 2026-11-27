import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

/* One-time codes. A 5-digit code with unlimited attempts is a 100k search
   space; a 6-digit code that expires in minutes, stays hashed at rest, and
   is burned after a fixed number of wrong guesses is not. */

export const OTP_LENGTH = 6
export const OTP_TTL_MS = 5 * 60_000
export const OTP_RESEND_COOLDOWN_MS = 60_000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_PATTERN = /^\d{6}$/

export interface OtpChallenge {
   otpHash: string | null
   otpExpiresAt: Date | null
   otpAttempts: number
}

export function generateOtp(): string {
   return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0')
}

function otpPepper(): string {
   const pepper = process.env.OTP_PEPPER
   if (!pepper || pepper.length < 32) {
      throw new Error('OTP_PEPPER must be set to at least 32 characters')
   }
   return pepper
}

/* The identifier is part of the MAC input, so a hash lifted from one account
   cannot be replayed against another. The pepper lives outside the database. */
export function hashOtp(identifier: string, code: string): string {
   return createHmac('sha256', otpPepper())
      .update(`${identifier}:${code}`)
      .digest('hex')
}

export function otpMatches(storedHash: string, identifier: string, code: string): boolean {
   const expected = Buffer.from(storedHash, 'hex')
   const actual = Buffer.from(hashOtp(identifier, code), 'hex')

   return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** Column values for a freshly issued code. Plaintext is never persisted. */
export function otpFields(identifier: string, code: string, now = Date.now()) {
   return {
      otpHash: hashOtp(identifier, code),
      otpExpiresAt: new Date(now + OTP_TTL_MS),
      otpAttempts: 0,
   }
}

/** A code issued less than the cooldown ago. Expiry is issue time + TTL. */
export function isOtpCoolingDown(expiresAt: Date | null, now = Date.now()): boolean {
   if (!expiresAt) return false

   return expiresAt.getTime() - OTP_TTL_MS + OTP_RESEND_COOLDOWN_MS > now
}

/** Whether a stored challenge can still accept a guess. */
export function isOtpUsable(
   challenge: OtpChallenge,
   now = Date.now()
): challenge is { otpHash: string; otpExpiresAt: Date; otpAttempts: number } {
   return (
      challenge.otpHash !== null &&
      challenge.otpExpiresAt !== null &&
      challenge.otpExpiresAt.getTime() > now &&
      challenge.otpAttempts < OTP_MAX_ATTEMPTS
   )
}
