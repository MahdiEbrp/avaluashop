'use client'

import { Button } from '@/components/admin/ui/button'
import { DataTable } from '@/components/admin/ui/data-table'
import type { TableFeatures } from '@/lib/table-features'
import { type ColumnDef } from '@tanstack/react-table'
import { EditIcon } from 'lucide-react'
import Link from 'next/link'

export interface BannersColumn {
   id: string
   label: string
   createdAt: string
}

export const columns: ColumnDef<TableFeatures, BannersColumn>[] = [
   {
      accessorKey: 'label',
      header: 'Label',
   },
   {
      accessorKey: 'createdAt',
      header: 'Date',
   },
   {
      id: 'actions',
      cell: ({ row }) => (
         <Link href={`/admin/banners/${row.original.id}`}>
            <Button size="icon" variant="outline">
               <EditIcon className="h-4" />
            </Button>
         </Link>
      ),
   },
]

interface BannerClientProps {
   data: BannersColumn[]
}

export const BannersClient: React.FC<BannerClientProps> = ({ data }) => {
   return <DataTable searchKey="label" columns={columns} data={data} />
}
