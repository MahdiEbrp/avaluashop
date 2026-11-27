import { type SessionRole, verifyJWT } from '@/lib/jwt'
import { getErrorResponse } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Single proxy for the whole app (Next.js 16 renamed `middleware` to `proxy`).
 *
 * Protected areas:
 *   - /profile/**      storefront account pages  -> redirect to /login
 *   - /admin/**        admin panel (except /admin/login) -> redirect to /admin/login
 *   - /api/**          storefront API -> 401 JSON
 *   - /api/admin/**    admin API (except /api/admin/auth/**) -> 401 JSON
 *
 * Public endpoints are exempt from the session check. `/api/internal/**`
 * authenticates itself with `CRON_SECRET`, because cron callers carry no
 * session cookie.
 */

const PUBLIC_PREFIXES = ['/api/auth', '/api/admin/auth', '/api/internal']
const PUBLIC_PATHS = new Set(['/api/health', '/admin/login'])

/** Identity headers only this proxy may write. */
const IDENTITY_HEADERS = ['X-USER-ID', 'X-USER-ROLE'] as const

function isUnder(pathname: string, prefix: string): boolean {
   return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function isPublic(pathname: string): boolean {
   return (
      PUBLIC_PATHS.has(pathname) ||
      PUBLIC_PREFIXES.some((prefix) => isUnder(pathname, prefix))
   )
}

function withoutIdentityHeaders(headers: Headers): Headers {
   const clean = new Headers(headers)

   for (const name of IDENTITY_HEADERS) clean.delete(name)

   return clean
}

export async function proxy(req: NextRequest) {
   const { pathname } = req.nextUrl

   const isAdminArea = pathname.startsWith('/admin')
   const isAdminAPI = isUnder(pathname, '/api/admin')
   const isAPI = isUnder(pathname, '/api')

   /* A public route must never see identity headers from the client, or a
      future handler that trusts `X-USER-ID` could be impersonated. */
   if (isPublic(pathname)) {
      return NextResponse.next({ request: { headers: withoutIdentityHeaders(req.headers) } })
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

      /* Identity comes from the verified token only, so both headers are
         overwritten rather than trusted from the client. */
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('X-USER-ID', sub)
      requestHeaders.set('X-USER-ROLE', role ?? 'user')

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
