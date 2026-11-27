import { type SessionPayload, signJWT } from '@/lib/jwt'
import { NextResponse } from 'next/server'

/* Storefront sessions last 30 days. The admin panel gets 8 hours, because an
   admin token is the most valuable credential in the app and a leaked copy
   should age out within a working day. */
export const USER_SESSION_MINUTES = 30 * 24 * 60
export const ADMIN_SESSION_MINUTES = 8 * 60

/** Signs a session and returns the response that sets the auth cookies. */
export async function startSession(
   payload: SessionPayload,
   lifetimeMinutes: number
): Promise<NextResponse> {
   const token = await signJWT(payload, { exp: `${lifetimeMinutes}m` })
   const maxAge = lifetimeMinutes * 60

   const response = new NextResponse(JSON.stringify({ status: 'success', token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
   })

   response.cookies.set({
      name: 'token',
      value: token,
      httpOnly: true,
      // `lax` keeps the cookie off cross-site POSTs (CSRF) while still letting
      // a link from another site land with the session intact.
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV !== 'development',
      maxAge,
   })
   response.cookies.set({ name: 'logged-in', value: 'true', maxAge })

   return response
}
