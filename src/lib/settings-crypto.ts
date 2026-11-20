import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey() {
   const raw = process.env.APP_SETTINGS_ENCRYPTION_KEY
   if (!raw) throw new Error('APP_SETTINGS_ENCRYPTION_KEY is not configured')

   const key = /^[a-f0-9]{64}$/i.test(raw)
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'base64')

   if (key.length !== 32) {
      throw new Error('APP_SETTINGS_ENCRYPTION_KEY must encode exactly 32 bytes')
   }

   return key
}

/** Encrypt a server-side setting before persisting it. */
export function encryptSettingSecret(value: string) {
   if (!value) throw new Error('SETTING_SECRET_REQUIRED')

   const iv = randomBytes(12)
   const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)
   const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])

   return [
      'v1',
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      ciphertext.toString('base64'),
   ].join('.')
}

/** Decrypt a secret only in trusted server-side modules. */
export function decryptSettingSecret(value: string) {
   const [version, iv, tag, ciphertext, ...extra] = value.split('.')
   if (version !== 'v1' || !iv || !tag || !ciphertext || extra.length) {
      throw new Error('INVALID_ENCRYPTED_SETTING')
   }

   const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(iv, 'base64'))
   decipher.setAuthTag(Buffer.from(tag, 'base64'))

   return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
   ]).toString('utf8')
}
