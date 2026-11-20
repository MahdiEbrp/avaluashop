import prisma from '@/lib/prisma'
import { quoteShipping } from '@/lib/shipping'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
   try {
      const city = new URL(req.url).searchParams.get('city')?.trim() ?? ''
      const methods = await prisma.shippingMethod.findMany({
         where: { isActive: true },
         orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
         include: {
            carrier: { select: { id: true, code: true, title: true, isActive: true } },
         },
      })

      const result = methods.map((method) => {
         const quote = quoteShipping(method, city, 0)
         return {
            id: method.id,
            code: method.code,
            title: method.title,
            description: method.description,
            type: method.type,
            amount: method.amount,
            freeAbove: method.freeAbove,
            allowedCities: method.allowedCities,
            carrier: method.carrier
               ? {
                    id: method.carrier.id,
                    code: method.carrier.code,
                    title: method.carrier.title,
                    isActive: method.carrier.isActive,
                 }
               : null,
            available: quote.available,
            unavailableReason: quote.reason ?? null,
         }
      })

      return NextResponse.json(result, {
         headers: { 'Cache-Control': 'no-store' },
      })
   } catch (error) {
      console.error('[SHIPPING_METHODS_GET]', error)
      return NextResponse.json({ message: 'SHIPPING_METHODS_READ_FAILED' }, { status: 500 })
   }
}
