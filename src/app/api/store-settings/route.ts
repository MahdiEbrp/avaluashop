import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
   try {
      const settings = await prisma.storeSetting.findUnique({ where: { id: 'default' } })
      return NextResponse.json({
         taxEnabled: settings?.taxEnabled ?? true,
         taxRate: settings?.taxEnabled === false ? 0 : settings?.taxRate ?? 0.09,
         taxLabel: settings?.taxLabel ?? 'مالیات بر ارزش افزوده',
         currency: settings?.currency ?? 'IRT',
      })
   } catch (error) {
      console.error('[STORE_SETTINGS_GET]', error)
      return NextResponse.json({ message: 'STORE_SETTINGS_UNAVAILABLE' }, { status: 500 })
   }
}
