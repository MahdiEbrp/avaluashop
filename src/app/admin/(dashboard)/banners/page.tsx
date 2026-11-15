import { Button } from '@/components/admin/ui/button'
import { Heading } from '@/components/admin/ui/heading'
import { Separator } from '@/components/admin/ui/separator'
import prisma from '@/lib/prisma'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import Link from 'next/link'

import { BannersClient, BannersColumn } from './components/table'

export const dynamic = 'force-dynamic'

export default async function BannersPage() {
   const banners = await prisma.banner.findMany({
      orderBy: {
         createdAt: 'desc',
      },
   })

   const formattedBanners: BannersColumn[] = banners.map((item) => ({
      id: item.id,
      label: item.label,
      createdAt: format(item.createdAt, 'MMMM do, yyyy'),
   }))

   return (
      <div className="block space-y-4 my-6">
         <div className="flex items-center justify-between">
            <Heading
               title={`Banners (${banners.length})`}
               description="Manage banners for your store"
            />
            <Link href="/admin/banners/new">
               <Button>
                  <Plus className="mr-2 h-4" /> Add New
               </Button>
            </Link>
         </div>
         <Separator />
         <BannersClient data={formattedBanners} />
      </div>
   )
}
