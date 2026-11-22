'use client'

import { Button } from '@/components/admin/ui/button'
import { DataTable } from '@/components/admin/ui/data-table'
import type { TableFeatures } from '@/lib/table-features'
import { type ColumnDef } from '@tanstack/react-table'
import { CheckIcon, EditIcon, XIcon } from 'lucide-react'
import Link from 'next/link'

interface OrderTableProps {
   data: OrderColumn[]
}

export const OrderTable: React.FC<OrderTableProps> = ({ data }) => {
   return <DataTable searchKey="number" columns={OrderColumns} data={data} />
}

export interface OrderColumn {
   id: string
   isPaid: boolean
   payable: string
   number: string
   date: string
   createdAt: string
}

export const OrderColumns: ColumnDef<TableFeatures, OrderColumn>[] = [
   {
      accessorKey: 'number',
      header: 'Order Number',
   },
   {
      accessorKey: 'date',
      header: 'Date',
   },
   {
      accessorKey: 'payable',
      header: 'Payable',
   },
   {
      accessorKey: 'isPaid',
      header: 'Paid',
      cell: (props) => (props.cell.getValue() ? <CheckIcon /> : <XIcon />),
   },
   {
      id: 'actions',
      cell: ({ row }) => (
         <Link href={`/admin/orders/${row.original.id}`}>
            <Button size="icon" variant="outline">
               <EditIcon className="h-4" />
            </Button>
         </Link>
      ),
   },
]
