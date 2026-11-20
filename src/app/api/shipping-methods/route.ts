import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
   try {
      const methods = await prisma.shippingMethod.findMany({
         where: { isActive: true },
         orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
         select: {
            id: true,
            code: true,
            title: true,
            description: true,
            cost: true,
            freeShippingThreshold: true,
         },
      })
      return NextResponse.json(methods)
   } catch (error) {
      console.error('[SHIPPING_METHODS_GET]', error)
      return NextResponse.json({ message: 'SHIPPING_METHODS_UNAVAILABLE' }, { status: 500 })
   }
}
