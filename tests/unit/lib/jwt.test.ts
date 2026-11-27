import { SignJWT } from 'jose'

import { JWT_ISSUER, jwtSecret, signJWT, verifyJWT } from '@/lib/jwt'

const encoder = () => new TextEncoder().encode(process.env.JWT_SECRET_KEY)

beforeEach(() => {
   vi.spyOn(console, 'error').mockImplementation(() => {/* noop */})
})

afterEach(() => {
   vi.unstubAllEnvs()
   vi.restoreAllMocks()
})

describe('jwt', () => {
   it('signs a token that verifies with issuer and HS256 pinned', async () => {
      const token = await signJWT({ sub: 'user-1', role: 'admin' }, { exp: '5m' })
      const payload = await verifyJWT<{ sub: string; role: string; iss: string }>(token)

      expect(payload.sub).toBe('user-1')
      expect(payload.role).toBe('admin')
      expect(payload.iss).toBe(JWT_ISSUER)

      const header = JSON.parse(atob(token.split('.', 1)[0]))
      expect(header.alg).toBe('HS256')
   })

   it('sets issued-at and expiry from the requested lifetime', async () => {
      const token = await signJWT({ sub: 'user-1', role: 'user' }, { exp: '5m' })
      const claims = await verifyJWT<{ iat: number; exp: number }>(token)

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
      const foreign = await new SignJWT({ role: 'admin' })
         .setProtectedHeader({ alg: 'HS256' })
         .setIssuer(JWT_ISSUER)
         .setSubject('intruder')
         .sign(new TextEncoder().encode('a-completely-different-secret-key'))

      await expect(verifyJWT(foreign)).rejects.toThrow()
      expect(console.error).toHaveBeenCalledWith(
         expect.objectContaining({ error: expect.any(Error) })
      )
   })

   it('rejects an expired token', async () => {
      const expired = await new SignJWT({ role: 'user' })
         .setProtectedHeader({ alg: 'HS256' })
         .setIssuer(JWT_ISSUER)
         .setSubject('user-3')
         .setExpirationTime('-1m')
         .sign(encoder())

      await expect(verifyJWT(expired)).rejects.toThrow(/exp/i)
   })

   it('rejects another HMAC family even over the same secret', async () => {
      /* Pinned to HS256 on verify, so an HS512 token is refused. */
      const hs512 = await new SignJWT({ role: 'user' })
         .setProtectedHeader({ alg: 'HS512' })
         .setIssuer(JWT_ISSUER)
         .setSubject('user-4')
         .sign(encoder())

      await expect(verifyJWT(hs512)).rejects.toMatchObject({
         code: 'ERR_JOSE_ALG_NOT_ALLOWED',
      })
   })

   it('rejects a token without the expected issuer', async () => {
      const wrongIssuer = await new SignJWT({ role: 'admin' })
         .setProtectedHeader({ alg: 'HS256' })
         .setIssuer('someone-else')
         .setSubject('user-5')
         .setExpirationTime('5m')
         .sign(encoder())

      await expect(verifyJWT(wrongIssuer)).rejects.toThrow(/iss/i)
   })

   it('refuses to sign or verify when the secret is missing', async () => {
      vi.stubEnv('JWT_SECRET_KEY', '')

      await expect(signJWT({ sub: 'user-6', role: 'user' }, { exp: '5m' })).rejects.toThrow(
         /JWT_SECRET_KEY/
      )
      await expect(verifyJWT('a.b.c')).rejects.toThrow(/JWT_SECRET_KEY/)
   })

   it('refuses a secret shorter than 32 characters', () => {
      vi.stubEnv('JWT_SECRET_KEY', 'too-short')

      expect(() => jwtSecret()).toThrow(/at least 32 characters/)
   })

   it('returns the secret bytes when it is long enough', () => {
      vi.stubEnv('JWT_SECRET_KEY', 'x'.repeat(32))

      expect(jwtSecret()).toHaveLength(32)
   })
})
