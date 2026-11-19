'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from '@/components/ui/table'
import { type TableFeatures, avaluaTableFeatures } from '@/lib/table-features'
import {
   type ColumnDef,
   type ColumnFiltersState,
   type RowData,
   flexRender,
   useTable,
} from '@tanstack/react-table'
import { useState } from 'react'

interface DataTableProps<TData extends RowData, TValue> {
   columns: ColumnDef<TableFeatures, TData, TValue>[]
   data: TData[]
   searchKey: string
}

export function DataTable<TData extends RowData, TValue>({
   columns,
   data,
   searchKey,
}: Readonly<DataTableProps<TData, TValue>>) {
   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
   const table = useTable({
      features: avaluaTableFeatures,
      data,
      columns,
      onColumnFiltersChange: setColumnFilters,
      state: {
         columnFilters,
      },
   })

   return (
      <div>
         <div className="flex items-center py-4">
            <Input
               placeholder="Search"
               value={
                  (table.getColumn(searchKey)?.getFilterValue() as string) ?? ''
               }
               onChange={(event) => {
                  table.getColumn(searchKey)?.setFilterValue(event.target.value)
               }}
               className="max-w-sm"
            />
         </div>
         <div className="rounded-md border">
            <Table>
               <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                     <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                           return (
                              <TableHead key={header.id}>
                                 {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                         header.column.columnDef.header,
                                         header.getContext()
                                      )}
                              </TableHead>
                           )
                        })}
                     </TableRow>
                  ))}
               </TableHeader>
               <TableBody>
                  {table.getRowModel().rows?.length ? (
                     table.getRowModel().rows.map((row) => (
                        <TableRow
                           key={row.id}
                           /* Selection is never enabled for these tables,
                              so this always evaluates to false. */
                           /* v8 ignore next */
                           data-state={row.getIsSelected() && 'selected'}
                        >
                           {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                 {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                 )}
                              </TableCell>
                           ))}
                        </TableRow>
                     ))
                  ) : (
                     <TableRow>
                        <TableCell
                           colSpan={columns.length}
                           className="h-24 text-center"
                        >
                           No results.
                        </TableCell>
                     </TableRow>
                  )}
               </TableBody>
            </Table>
         </div>
         <div className="flex items-center justify-end space-x-2 py-4">
            <Button
               variant="outline"
               size="sm"
               onClick={() => {
                  table.previousPage()
               }}
               disabled={!table.getCanPreviousPage()}
            >
               Previous
            </Button>
            <Button
               variant="outline"
               size="sm"
               onClick={() => {
                  table.nextPage()
               }}
               disabled={!table.getCanNextPage()}
            >
               Next
            </Button>
         </div>
      </div>
   )
}
