import { SignJWT } from 'jose'

import { signJWT, verifyJWT } from '@/lib/jwt'

const SECRET = process.env.JWT_SECRET_KEY as string
const encoder = () => new TextEncoder().encode(SECRET)

describe('jwt', () => {
   it('signs a token that jose can verify', async () => {
      const token = await signJWT({ sub: 'user-1', role: 'admin' }, { exp: '5m' })
      const payload = await verifyJWT<{ sub: string; role: string }>(token)

      expect(payload.sub).toBe('user-1')
      expect(payload.role).toBe('admin')
      const claims = payload as unknown as { iat: number; exp: number }
      expect(claims.iat).toBeTypeOf('number')
      expect(claims.exp - claims.iat).toBe(300)
   })

   it('round-trips the user role', async () => {
      const token = await signJWT({ sub: 'user-2', role: 'user' }, { exp: '1h' })
      await expect(verifyJWT<{ role: string }>(token)).resolves.toMatchObject({
         sub: 'user-2',
         role: 'user',
      })
   })

   it('rejects a token signed with another secret and logs the failure', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const foreign = await new SignJWT({ role: 'admin' })
         .setProtectedHeader({ alg: 'HS256' })
         .setSubject('intruder')
         .sign(new TextEncoder().encode('a-completely-different-secret-key'))

      await expect(verifyJWT(foreign)).rejects.toThrow()
      expect(errorSpy).toHaveBeenCalledWith(
         expect.objectContaining({ error: expect.any(Error) })
      )
   })

   it('rejects an expired token', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const expired = await new SignJWT({ role: 'user' })
         .setProtectedHeader({ alg: 'HS256' })
         .setSubject('user-3')
         .setExpirationTime('-1m')
         .sign(encoder())

      await expect(verifyJWT(expired)).rejects.toThrow(/exp/i)
   })

   it('accepts a validly signed HMAC token of another strength', async () => {
      /* The app only pins the family, not the exact size: jose verifies with
         the key, so an HS512 signature over the same secret is valid. */
      const hs512 = await new SignJWT({ role: 'user' })
         .setProtectedHeader({ alg: 'HS512' })
         .setSubject('user-4')
         .sign(encoder())

      await expect(verifyJWT(hs512)).resolves.toMatchObject({ sub: 'user-4' })
   })

   it('rejects a token signed with an asymmetric algorithm', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const { privateKey } = (await crypto.subtle.generateKey(
         {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
         },
         true,
         ['sign', 'verify']
      )) as CryptoKeyPair

      const rs256 = await new SignJWT({ role: 'admin' })
         .setProtectedHeader({ alg: 'RS256' })
         .setSubject('intruder')
         .sign(privateKey)

      await expect(verifyJWT(rs256)).rejects.toThrow()
   })
})
