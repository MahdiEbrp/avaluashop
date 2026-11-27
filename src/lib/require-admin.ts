/**
 * Second layer behind `proxy.ts`. The proxy verifies the JWT and stamps
 * `X-USER-ID` and `X-USER-ROLE` from it; the proxy also strips those headers
 * from every public path, so a client cannot inject them there. A route that
 * is ever reached without the proxy still refuses unless the role is `admin`.
 */
export function adminId(req: Request): string | null {
   if (req.headers.get('X-USER-ROLE') !== 'admin') return null

   return req.headers.get('X-USER-ID') || null
}
