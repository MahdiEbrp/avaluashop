'use client'

import { Button } from '@/components/admin/ui/button'
import { DataTable } from '@/components/admin/ui/data-table'
import type { TableFeatures } from '@/lib/table-features'
import { type ColumnDef } from '@tanstack/react-table'
import { EditIcon } from 'lucide-react'
import Link from 'next/link'

export interface BrandColumn {
   id: string
   title: string
   products: number
}

export const columns: ColumnDef<TableFeatures, BrandColumn>[] = [
   {
      accessorKey: 'title',
      header: 'Title',
   },
   {
      accessorKey: 'products',
      header: 'Products #',
   },
   {
      id: 'actions',
      cell: ({ row }) => (
         <Link href={`/admin/brands/${row.original.id}`}>
            <Button size="icon" variant="outline">
               <EditIcon className="h-4" />
            </Button>
         </Link>
      ),
   },
]

interface BrandsClientProps {
   data: BrandColumn[]
}

export const BrandsClient: React.FC<BrandsClientProps> = ({ data }) => {
   return <DataTable searchKey="title" columns={columns} data={data} />
}
