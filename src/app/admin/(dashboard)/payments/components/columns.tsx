'use client'

import { Button } from '@/components/admin/ui/button'
import type { TableFeatures } from '@/lib/table-features'
import { type ColumnDef } from '@tanstack/react-table'
import { CheckIcon, EditIcon, XIcon } from 'lucide-react'
import Link from 'next/link'

export interface PaymentColumn {
   id: string
   number: string
   isSuccessful: boolean
   payable: string
   status: string
   createdAt: string
}

export const columns: ColumnDef<TableFeatures, PaymentColumn>[] = [
   {
      accessorKey: 'number',
      header: 'Payment Number',
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
      accessorKey: 'isSuccessful',
      header: 'Successful',
      cell: (props) => {
         return props.cell.getValue() ? <CheckIcon /> : <XIcon />
      },
   },
   {
      id: 'actions',
      cell: ({ row }) => (
         <Link href={`/admin/payments/${row.original.id}`}>
            <Button size="icon" variant="outline">
               <EditIcon className="h-4" />
            </Button>
         </Link>
      ),
   },
]
