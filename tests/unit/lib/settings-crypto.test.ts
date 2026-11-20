import { decryptSettingSecret, encryptSettingSecret } from '@/lib/settings-crypto'

const KEY_BASE64 = Buffer.alloc(32, 7).toString('base64')
const KEY_HEX = Buffer.alloc(32, 11).toString('hex')

beforeEach(() => {
   process.env.APP_SETTINGS_ENCRYPTION_KEY = KEY_BASE64
})

afterEach(() => {
   delete process.env.APP_SETTINGS_ENCRYPTION_KEY
})

describe('settings-crypto', () => {
   it('round-trips a secret and never stores it in the clear', () => {
      const blob = encryptSettingSecret('merchant-key-abcdef')

      expect(decryptSettingSecret(blob)).toBe('merchant-key-abcdef')
      expect(blob).not.toContain('merchant-key-abcdef')
      expect(blob.split('.')).toHaveLength(4)
      expect(blob.startsWith('v1.')).toBe(true)
   })

   it('derives the same key from a hex-encoded secret', () => {
      process.env.APP_SETTINGS_ENCRYPTION_KEY = KEY_HEX
      const blob = encryptSettingSecret('hex-keyed')

      expect(decryptSettingSecret(blob)).toBe('hex-keyed')
   })

   it('uses a fresh IV for every encryption', () => {
      const blobs = new Set(
         Array.from({ length: 50 }, () => encryptSettingSecret('same-value'))
      )

      expect(blobs.size).toBe(50)
   })

   it('refuses an empty secret', () => {
      expect(() => encryptSettingSecret('')).toThrow('SETTING_SECRET_REQUIRED')
   })

   it('refuses to work without a key', () => {
      delete process.env.APP_SETTINGS_ENCRYPTION_KEY

      expect(() => encryptSettingSecret('x')).toThrow(
         'APP_SETTINGS_ENCRYPTION_KEY is not configured'
      )
   })

   it.each([
      ['a short key', 'tooshort'],
      ['a key of the wrong length', Buffer.alloc(16, 1).toString('base64')],
   ])('refuses %s', (_label, key) => {
      process.env.APP_SETTINGS_ENCRYPTION_KEY = key

      expect(() => encryptSettingSecret('x')).toThrow(
         'APP_SETTINGS_ENCRYPTION_KEY must encode exactly 32 bytes'
      )
   })

   it('rejects a tampered ciphertext', () => {
      const parts = encryptSettingSecret('original').split('.')
      parts[3] = Buffer.from('tampered').toString('base64')

      expect(() => decryptSettingSecret(parts.join('.'))).toThrow()
   })

   it('rejects a tampered auth tag', () => {
      const parts = encryptSettingSecret('original').split('.')
      parts[2] = Buffer.alloc(16, 1).toString('base64')

      expect(() => decryptSettingSecret(parts.join('.'))).toThrow()
   })

   it('rejects a blob encrypted with a different key', () => {
      const blob = encryptSettingSecret('original')
      process.env.APP_SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64')

      expect(() => decryptSettingSecret(blob)).toThrow()
   })

   it.each([
      ['an unknown version', 'v2.a.b.c'],
      ['a single segment', 'garbage'],
      ['an empty IV', 'v1..b.c'],
      ['a trailing segment', 'v1.a.b.c.d'],
   ])('rejects %s', (_label, blob) => {
      expect(() => decryptSettingSecret(blob)).toThrow('INVALID_ENCRYPTED_SETTING')
   })
})
