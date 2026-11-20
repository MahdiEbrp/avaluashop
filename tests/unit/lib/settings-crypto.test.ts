import { decryptSettingSecret, encryptSettingSecret } from '@/lib/settings-crypto'

describe('settings secret encryption', () => {
   const originalKey = process.env.APP_SETTINGS_ENCRYPTION_KEY

   beforeEach(() => {
      process.env.APP_SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
   })

   afterEach(() => {
      if (originalKey === undefined) delete process.env.APP_SETTINGS_ENCRYPTION_KEY
      else process.env.APP_SETTINGS_ENCRYPTION_KEY = originalKey
   })

   it('round-trips a secret without storing plaintext', () => {
      const secret = 'merchant-secret-value'
      const encrypted = encryptSettingSecret(secret)

      expect(encrypted).not.toContain(secret)
      expect(decryptSettingSecret(encrypted)).toBe(secret)
   })

   it('rejects modified ciphertext', () => {
      const encrypted = encryptSettingSecret('merchant-secret-value')
      const parts = encrypted.split('.')
      parts[3] = Buffer.from('tampered').toString('base64')

      expect(() => decryptSettingSecret(parts.join('.'))).toThrow()
   })

   it('rejects missing or malformed encryption keys', () => {
      delete process.env.APP_SETTINGS_ENCRYPTION_KEY
      expect(() => encryptSettingSecret('secret')).toThrow('APP_SETTINGS_ENCRYPTION_KEY')
      process.env.APP_SETTINGS_ENCRYPTION_KEY = 'short'
      expect(() => encryptSettingSecret('secret')).toThrow('exactly 32 bytes')
   })
})
