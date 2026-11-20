import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

function encryptionKey() {
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

/** Encrypt gateway credentials before persisting them in the database. */
export function encryptSettingSecret(value: string) {
   const iv = randomBytes(12)
   const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
   const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
   const tag = cipher.getAuthTag()

   return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.')
}

/** Decrypt a secret only inside trusted server-side code. */
export function decryptSettingSecret(value: string) {
   const [version, iv, tag, encrypted] = value.split('.')
   if (version !== 'v1' || !iv || !tag || !encrypted) {
      throw new Error('INVALID_ENCRYPTED_SETTING')
   }

   const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, 'base64'))
   decipher.setAuthTag(Buffer.from(tag, 'base64'))
   return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
   ]).toString('utf8')
}
