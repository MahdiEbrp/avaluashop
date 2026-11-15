import {
   columnFilteringFeature,
   columnVisibilityFeature,
   // required for row.getVisibleCells()
   createFilteredRowModel,
   createPaginatedRowModel,
   rowPaginationFeature,
   rowSelectionFeature,
   tableFeatures,
} from '@tanstack/react-table'

/**
 * TanStack Table v9 requires table features to be registered statically, outside
 * of React render. Import this object anywhere you need to type `ColumnDef`, e.g.
 *
 * ```ts
 * const columns: ColumnDef<TableFeatures, ProductColumn>[] = [ ... ]
 * ```
 */
export const avaluaTableFeatures = tableFeatures({
   columnFilteringFeature,
   columnVisibilityFeature, // required for row.getVisibleCells()
   rowPaginationFeature,
   rowSelectionFeature,
   filteredRowModel: createFilteredRowModel(),
   paginatedRowModel: createPaginatedRowModel(),
})

export type TableFeatures = typeof avaluaTableFeatures
