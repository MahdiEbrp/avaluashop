import { SignJWT, jwtVerify } from 'jose'

/**
 * Who a session belongs to. A storefront session is a `user`; the admin panel
 * issues `admin`. `sub` alone cannot tell them apart — a `User` id and an
 * `Owner` id are both cuids — so the role travels inside the signed token and
 * `proxy.ts` refuses `/admin/**` and `/api/admin/**` for anything but `admin`.
 */
export type SessionRole = 'user' | 'admin'

export interface SessionPayload {
   sub: string
   role: SessionRole
}

export const signJWT = async (
   payload: { sub: string; role: SessionRole },
   options: { exp: string }
) => {
   const secret = new TextEncoder().encode(process.env.JWT_SECRET_KEY)
   const alg = 'HS256'

   return await new SignJWT({ role: payload.role })
      .setProtectedHeader({ alg })
      .setExpirationTime(options.exp)
      .setIssuedAt()
      .setSubject(payload.sub)
      .sign(secret)
}

export const verifyJWT = async <T>(token: string): Promise<T> => {
   try {
      const { payload } = await jwtVerify(
         token,
         new TextEncoder().encode(process.env.JWT_SECRET_KEY)
      )

      return payload as T
   } catch (error) {
      console.error({ error })
      throw error
   }
}
