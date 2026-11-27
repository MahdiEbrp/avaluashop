import { SignJWT, jwtVerify } from 'jose'

/**
 * Who a session belongs to. A storefront session is a `user`; the admin panel
 * issues `admin`. `sub` alone cannot tell them apart (a `User` id and an
 * `Owner` id are both cuids), so the role travels inside the signed token.
 */
export type SessionRole = 'user' | 'admin'

export interface SessionPayload {
   sub: string
   role: SessionRole
}

export const JWT_ALGORITHM = 'HS256'
export const JWT_ISSUER = 'avaluashop'
export const JWT_MIN_SECRET_LENGTH = 32

/** Fails closed: a missing or short secret must never sign or accept a token. */
export function jwtSecret(): Uint8Array {
   const value = process.env.JWT_SECRET_KEY

   if (!value || value.length < JWT_MIN_SECRET_LENGTH) {
      throw new Error(
         `JWT_SECRET_KEY must be set to at least ${JWT_MIN_SECRET_LENGTH} characters`
      )
   }

   return new TextEncoder().encode(value)
}

export const signJWT = async (
   payload: SessionPayload,
   options: { exp: string }
) =>
   await new SignJWT({ role: payload.role })
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .setIssuer(JWT_ISSUER)
      .setExpirationTime(options.exp)
      .setIssuedAt()
      .setSubject(payload.sub)
      .sign(jwtSecret())

export const verifyJWT = async <T>(token: string): Promise<T> => {
   try {
      const { payload } = await jwtVerify(token, jwtSecret(), {
         algorithms: [JWT_ALGORITHM],
         issuer: JWT_ISSUER,
      })

      return payload as T
   } catch (error) {
      console.error({ error })
      throw error
   }
}
