import {
   OTP_MAX_ATTEMPTS,
   OTP_PATTERN,
   OTP_TTL_MS,
   generateOtp,
   hashOtp,
   isOtpCoolingDown,
   isOtpUsable,
   otpFields,
   otpMatches,
} from '@/lib/otp'

afterEach(() => {
   vi.unstubAllEnvs()
})

describe('generateOtp', () => {
   it('always yields six digits, including leading zeros', () => {
      const codes = Array.from({ length: 400 }, () => generateOtp())

      for (const code of codes) expect(code).toMatch(OTP_PATTERN)
      expect(codes.some((code) => code.startsWith('0'))).toBe(true)
      expect(new Set(codes).size).toBeGreaterThan(300)
   })
})

describe('OTP_PATTERN', () => {
   it('accepts exactly six digits', () => {
      expect(OTP_PATTERN.test('123456')).toBe(true)
      expect(OTP_PATTERN.test('12345')).toBe(false)
      expect(OTP_PATTERN.test('1234567')).toBe(false)
      expect(OTP_PATTERN.test('abcdef')).toBe(false)
   })
})

describe('hashOtp and otpMatches', () => {
   it('is deterministic for one identifier and code', () => {
      expect(hashOtp('a@example.com', '123456')).toBe(hashOtp('a@example.com', '123456'))
   })

   it('binds the hash to the identifier so it cannot be replayed across accounts', () => {
      expect(hashOtp('a@example.com', '123456')).not.toBe(hashOtp('b@example.com', '123456'))
   })

   it('never equals the plaintext code', () => {
      expect(hashOtp('a@example.com', '123456')).not.toContain('123456')
   })

   it('matches only the right code for the right identifier', () => {
      const stored = hashOtp('a@example.com', '123456')

      expect(otpMatches(stored, 'a@example.com', '123456')).toBe(true)
      expect(otpMatches(stored, 'a@example.com', '654321')).toBe(false)
      expect(otpMatches(stored, 'b@example.com', '123456')).toBe(false)
   })

   it('rejects a stored value of the wrong length without comparing', () => {
      expect(otpMatches('abcd', 'a@example.com', '123456')).toBe(false)
   })

   it('refuses to hash when the pepper is missing', () => {
      vi.stubEnv('OTP_PEPPER', '')

      expect(() => hashOtp('a@example.com', '123456')).toThrow(/OTP_PEPPER/)
   })

   it('refuses a pepper shorter than 32 characters', () => {
      vi.stubEnv('OTP_PEPPER', 'short')

      expect(() => hashOtp('a@example.com', '123456')).toThrow(/at least 32/)
   })
})

describe('otpFields', () => {
   it('returns a hash, an expiry five minutes out, and a zero attempt count', () => {
      const now = 1_700_000_000_000
      const fields = otpFields('a@example.com', '123456', now)

      expect(fields.otpHash).toBe(hashOtp('a@example.com', '123456'))
      expect(fields.otpExpiresAt.getTime()).toBe(now + OTP_TTL_MS)
      expect(fields.otpAttempts).toBe(0)
   })
})

describe('isOtpCoolingDown', () => {
   const now = 1_000_000

   it('is false when nothing was issued', () => {
      expect(isOtpCoolingDown(null, now)).toBe(false)
   })

   it('is true within a minute of issue', () => {
      const issuedAt = now - 30_000
      const expiresAt = new Date(issuedAt + OTP_TTL_MS)

      expect(isOtpCoolingDown(expiresAt, now)).toBe(true)
   })

   it('is false once the cooldown has passed', () => {
      const issuedAt = now - 90_000
      const expiresAt = new Date(issuedAt + OTP_TTL_MS)

      expect(isOtpCoolingDown(expiresAt, now)).toBe(false)
   })
})

describe('isOtpUsable', () => {
   const now = 1_000_000
   const live = {
      otpHash: 'abc',
      otpExpiresAt: new Date(now + 60_000),
      otpAttempts: 0,
   }

   it('accepts a live challenge with attempts left', () => {
      expect(isOtpUsable(live, now)).toBe(true)
   })

   it('rejects a record with no pending code', () => {
      expect(isOtpUsable({ ...live, otpHash: null }, now)).toBe(false)
   })

   it('rejects a record with no expiry', () => {
      expect(isOtpUsable({ ...live, otpExpiresAt: null }, now)).toBe(false)
   })

   it('rejects an expired code', () => {
      expect(isOtpUsable({ ...live, otpExpiresAt: new Date(now - 1) }, now)).toBe(false)
   })

   it('rejects a code whose attempts are spent', () => {
      expect(isOtpUsable({ ...live, otpAttempts: OTP_MAX_ATTEMPTS }, now)).toBe(false)
   })
})
