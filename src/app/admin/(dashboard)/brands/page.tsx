import { Button } from '@/components/admin/ui/button'
import { Heading } from '@/components/admin/ui/heading'
import { Separator } from '@/components/admin/ui/separator'
import prisma from '@/lib/prisma'
import { Plus } from 'lucide-react'
import Link from 'next/link'

import { BrandColumn, BrandsClient } from './components/table'

export const dynamic = 'force-dynamic'

export default async function BrandsPage() {
   const brands = await prisma.brand.findMany({
      select: {
         id: true,
         title: true,
         _count: { select: { products: true } },
      },
      orderBy: { title: 'asc' },
   })

   const formattedBrands: BrandColumn[] = brands.map((brand) => ({
      id: brand.id,
      title: brand.title,
      products: brand._count.products,
   }))

   return (
      <div className="my-6 block space-y-4">
         <div className="flex items-center justify-between">
            <Heading
               title={`Brands (${brands.length})`}
               description="Manage brands for your store"
            />
            <Link href="/admin/brands/new">
               <Button>
                  <Plus className="mr-2 h-4" /> Add New
               </Button>
            </Link>
         </div>
         <Separator />
         <BrandsClient data={formattedBrands} />
      </div>
   )
}
