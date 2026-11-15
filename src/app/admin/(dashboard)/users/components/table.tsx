'use client'

import { Badge } from '@/components/admin/ui/badge'
import { DataTable } from '@/components/admin/ui/data-table'
import type { TableFeatures } from '@/lib/table-features'
import { type ColumnDef } from '@tanstack/react-table'
import { EditIcon, LinkIcon } from 'lucide-react'
import Link from 'next/link'

export interface UserColumn {
   id: string
   name: string
   email: string
   phone: string
   orders: number
}

export const columns: ColumnDef<TableFeatures, UserColumn>[] = [
   {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
         <Link href={`/admin/users/${row.original.id}`}>
            <p>{row.original.name}</p>
         </Link>
      ),
   },
   {
      accessorKey: 'email',
      header: 'Email',
   },
   {
      accessorKey: 'phone',
      header: 'Phone',
   },
   {
      accessorKey: 'orders',
      header: 'Order #',
      cell: ({ row }) => (
         <Link href={`/admin/orders?userId=${row.original.id}`}>
            <Badge className="items-center flex gap-1 w-min">
               <LinkIcon className="h-3" />
               <p className="shrink-0">{row.original.orders} Orders</p>
            </Badge>
         </Link>
      ),
   },
   {
      id: 'actions',
      cell: ({ row }) => (
         <Link href={`/admin/users/${row.original.id}`}>
            <Badge className="items-center flex gap-1 w-min">
               <EditIcon className="h-3 p-0" />
               <p>Edit</p>
            </Badge>
         </Link>
      ),
   },
]

interface UsersTableProps {
   data: UserColumn[]
}

export const UsersTable: React.FC<UsersTableProps> = ({ data }) => {
   return <DataTable searchKey="name" columns={columns} data={data} />
}
