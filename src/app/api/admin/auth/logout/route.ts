import { NextResponse } from 'next/server'

/**
 * Ends the session.
 *
 * Returns a JSON 200 rather than a redirect: every /api route is contractually
 * a non-redirect JSON endpoint, and the callers reload the page themselves.
 */
export function GET() {
   const response = NextResponse.json({
      status: 'success',
      message: 'LOGGED_OUT',
   })

   response.cookies.delete('token')
   response.cookies.delete('logged-in')

   return response
}
