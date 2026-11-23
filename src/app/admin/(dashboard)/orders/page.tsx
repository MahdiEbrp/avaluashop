import { Heading } from '@/components/admin/ui/heading'
import { Separator } from '@/components/admin/ui/separator'
import type { Prisma } from '@/generated/prisma/client'
import prisma from '@/lib/prisma'
import { format } from 'date-fns'
import Link from 'next/link'

import { SortBy } from './components/options'
import type { OrderColumn } from './components/table'
import { OrderTable } from './components/table'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

interface SearchParams {
   userId?: string
   sort?: string
   isPaid?: string
   brand?: string
   category?: string
   page?: string
   minPayable?: string
   maxPayable?: string
}

function getOrderBy(sort?: string): Prisma.OrderOrderByWithRelationInput {
   if (sort === 'highest_payable') return { payable: 'desc' }
   if (sort === 'lowest_payable') return { payable: 'asc' }
   return { createdAt: 'desc' }
}

function buildPageUrl(params: SearchParams, page: number) {
   const query = new URLSearchParams()
   for (const [key, value] of Object.entries({ ...params, page: String(page) })) {
      if (value) query.set(key, value)
   }
   return `/admin/orders?${query.toString()}`
}

function buildPayableFilter(
   params: SearchParams
): Prisma.FloatFilter | undefined {
   const minPayable = params.minPayable ? Number(params.minPayable) : undefined
   const maxPayable = params.maxPayable ? Number(params.maxPayable) : undefined
   const hasMin = minPayable !== undefined && Number.isFinite(minPayable)
   const hasMax = maxPayable !== undefined && Number.isFinite(maxPayable)
   if (!hasMin && !hasMax) return undefined
   return {
      ...(hasMin ? { gte: minPayable } : {}),
      ...(hasMax ? { lte: maxPayable } : {}),
   }
}

function buildOrderWhere(params: SearchParams): Prisma.OrderWhereInput {
   const where: Prisma.OrderWhereInput = {}
   if (params.userId) where.userId = params.userId
   if (params.isPaid === 'true' || params.isPaid === 'false') {
      where.isPaid = params.isPaid === 'true'
   }
   const payable = buildPayableFilter(params)
   if (payable) where.payable = payable

   if (params.brand || params.category) {
      where.orderItems = {
         some: {
            product: {
               ...(params.brand
                  ? {
                       brand: {
                          title: { contains: params.brand, mode: 'insensitive' },
                       },
                    }
                  : {}),
               ...(params.category
                  ? {
                       categories: {
                          some: {
                             title: {
                                contains: params.category,
                                mode: 'insensitive',
                             },
                          },
                       },
                    }
                  : {}),
            },
         },
      }
   }
   return where
}

export default async function OrdersPage({
   searchParams,
}: Readonly<{
   searchParams?: Promise<SearchParams>
}> = {}) {
   const params = (await searchParams) ?? {}
   const requestedPage = Number.parseInt(params.page ?? '1', 10)
   const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1
   const where = buildOrderWhere(params)

   const [totalOrders, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
         where,
         select: {
            id: true,
            number: true,
            createdAt: true,
            payable: true,
            isPaid: true,
         },
         skip: (page - 1) * PAGE_SIZE,
         take: PAGE_SIZE,
         orderBy: getOrderBy(params.sort),
      }),
   ])

   const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE))
   const formattedOrders: OrderColumn[] = orders.map((order) => ({
      id: order.id,
      number: `سفارش #${new Intl.NumberFormat('fa-IR').format(order.number)}`,
      date: order.createdAt.toLocaleDateString('fa-IR'),
      payable: `${new Intl.NumberFormat('fa-IR').format(Math.round(order.payable))} تومان`,
      isPaid: order.isPaid,
      createdAt: format(order.createdAt, 'MMMM do, yyyy'),
   }))

   return (
      <div className="my-6 block space-y-4">
         <Heading
            title={`سفارش‌ها (${new Intl.NumberFormat('fa-IR').format(totalOrders)})`}
            description="بررسی، پیگیری و مدیریت سفارش‌های ثبت‌شده"
         />
         <Separator />
         <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <SortBy initialData={params.sort ?? 'highest_payable'} />
         </div>
         <OrderTable data={formattedOrders} />
         <div className="flex items-center justify-between text-sm">
            <span>
               صفحه {new Intl.NumberFormat('fa-IR').format(page)} از{' '}
               {new Intl.NumberFormat('fa-IR').format(totalPages)}
            </span>
            <div className="flex gap-2">
               {page > 1 ? (
                  <Link
                     className="rounded-md border px-3 py-2"
                     href={buildPageUrl(params, page - 1)}
                  >
                     قبلی
                  </Link>
               ) : (
                  <span
                     aria-disabled="true"
                     className="rounded-md border px-3 py-2 text-muted-foreground"
                  >
                     قبلی
                  </span>
               )}
               {page < totalPages ? (
                  <Link
                     className="rounded-md border px-3 py-2"
                     href={buildPageUrl(params, page + 1)}
                  >
                     بعدی
                  </Link>
               ) : (
                  <span
                     aria-disabled="true"
                     className="rounded-md border px-3 py-2 text-muted-foreground"
                  >
                     بعدی
                  </span>
               )}
            </div>
         </div>
      </div>
   )
}
