import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
   try {
      const settings = await prisma.storeSetting.findUnique({
         where: { id: 'default' },
         select: { taxEnabled: true, taxRate: true, taxLabel: true, currency: true },
      })

      return NextResponse.json({
         taxEnabled: settings?.taxEnabled ?? true,
         taxRate: settings?.taxRate ?? 0.09,
         taxLabel: settings?.taxLabel ?? 'مالیات بر ارزش افزوده',
         currency: settings?.currency ?? 'IRT',
      }, {
         headers: { 'Cache-Control': 'no-store' },
      })
   } catch (error) {
      console.error('[STORE_SETTINGS_GET]', error)
      return NextResponse.json({ message: 'STORE_SETTINGS_READ_FAILED' }, { status: 500 })
   }
}
