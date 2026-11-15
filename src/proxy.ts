import { type SessionRole, verifyJWT } from '@/lib/jwt'
import { getErrorResponse } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Single proxy for the whole app (Next.js 16 renamed `middleware` to `proxy`).
 *
 * Protected areas:
 *   - /profile/**      storefront account pages  -> redirect to /login
 *   - /admin/**        admin panel (except /admin/login) -> redirect to /admin/login
 *   - /api/**          storefront API (except /api/auth/**)      -> 401 JSON
 *   - /api/admin/**    admin API (except /api/admin/auth/**)     -> 401 JSON
 */
export async function proxy(req: NextRequest) {
   const { pathname } = req.nextUrl

   const isAdminArea = pathname.startsWith('/admin')
   const isAdminAPI = pathname.startsWith('/api/admin')
   const isAPI = pathname.startsWith('/api')

   // Public endpoints: auth handshakes and the admin login screen.
   if (
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/admin/auth') ||
      pathname === '/api/health' ||
      pathname === '/admin/login'
   ) {
      return NextResponse.next()
   }

   const loginPath = isAdminArea ? '/admin/login' : '/login'

   function getToken() {
      let token: string | undefined

      if (req.cookies.has('token')) {
         token = req.cookies.get('token')?.value
      } else if (req.headers.get('Authorization')?.startsWith('Bearer ')) {
         token = req.headers.get('Authorization')?.slice(7)
      }

      return token
   }

   const token = getToken()

   if (!token) {
      if (isAPI) return getErrorResponse(401, 'INVALID TOKEN')

      return NextResponse.redirect(new URL(loginPath, req.url))
   }

   try {
      const { sub, role } = await verifyJWT<{
         sub: string
         role?: SessionRole
      }>(token)

      if (!sub) throw new Error('Invalid token payload')

      /* Admin scope is a role check, not just "is signed in": a storefront
         session must never reach the admin API or the admin panel. The token
         stays valid for the storefront, so it is not cleared here. */
      if ((isAdminArea || isAdminAPI) && role !== 'admin') {
         if (isAPI) return getErrorResponse(401, 'ADMIN ROLE REQUIRED')

         return NextResponse.redirect(new URL(loginPath, req.url))
      }

      // Forward the authenticated user id via *request* headers so downstream
      // route handlers see it in `req.headers.get('X-USER-ID')`.
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('X-USER-ID', sub)

      return NextResponse.next({ request: { headers: requestHeaders } })
   } catch {
      if (isAPI) return getErrorResponse(401, 'UNAUTHORIZED')

      const redirect = NextResponse.redirect(new URL(loginPath, req.url))
      redirect.cookies.delete('token')
      redirect.cookies.delete('logged-in')
      return redirect
   }
}

export const config = {
   matcher: ['/profile/:path*', '/admin/:path*', '/api/:path*'],
}
