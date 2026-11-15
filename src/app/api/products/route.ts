import { getProductsJson } from '@/lib/catalog'
import { NextResponse } from 'next/server'

/**
 * The storefront catalogue.
 *
 * Served from the tagged cache in `lib/catalog.ts` so the hottest read endpoint
 * does one small cache lookup instead of a join per request. It stays behind the
 * proxy's session check, so the response is `private` and must not be stored by
 * a shared cache.
 */
export async function GET() {
   try {
      const body = await getProductsJson()

      return new NextResponse(body, {
         status: 200,
         headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=0, must-revalidate',
         },
      })
   } catch (error) {
      console.error('[PRODUCT_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
