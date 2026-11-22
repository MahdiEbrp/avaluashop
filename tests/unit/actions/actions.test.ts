import { getGraphRevenue } from '@/actions/get-graph-revenue'
import { getSalesCount } from '@/actions/get-sales-count'
import { getStockCount } from '@/actions/get-stock-count'
import { getTotalRevenue } from '@/actions/get-total-revenue'
import { prismaMock } from '../support/db'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

const paidOrder = (createdAt: Date, payable: number, items: { price: number }[]) => ({
   createdAt,
   payable,
   orderItems: items,
})

describe('dashboard aggregates', () => {
   beforeEach(() => {
      prismaMock.order.findMany.mockReset()
      prismaMock.order.count.mockReset()
      prismaMock.product.count.mockReset()
   })

   it('reports the number of paid orders only', async () => {
      prismaMock.order.count.mockResolvedValue(7)

      await expect(getSalesCount()).resolves.toBe(7)
      expect(prismaMock.order.count).toHaveBeenCalledWith({ where: { isPaid: true } })
   })

   it('counts the buyable products only', async () => {
      prismaMock.product.count.mockResolvedValue(12)

      await expect(getStockCount()).resolves.toBe(12)
      expect(prismaMock.product.count).toHaveBeenCalledWith({
         where: { isAvailable: true },
      })
   })

   it('sums the final payable amount of paid orders', async () => {
      prismaMock.order.findMany.mockResolvedValue([
         { payable: 112.5 },
         { payable: 100 },
      ])

      await expect(getTotalRevenue()).resolves.toBe(212.5)
      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
         { where: { isPaid: true }, select: { payable: true } }
      )
   })

   it('reports zero revenue for an empty order book', async () => {
      prismaMock.order.findMany.mockResolvedValue([])

      await expect(getTotalRevenue()).resolves.toBe(0)
   })
})

describe('getGraphRevenue', () => {
   beforeEach(() => prismaMock.order.findMany.mockReset())

   it('returns twelve months, zeroed, in order', async () => {
      prismaMock.order.findMany.mockResolvedValue([])

      const graph = await getGraphRevenue()

      expect(graph).toHaveLength(12)
      expect(graph.map((point) => point.name)).toEqual([
         'Jan',
         'Feb',
         'Mar',
         'Apr',
         'May',
         'Jun',
         'Jul',
         'Aug',
         'Sep',
         'Oct',
         'Nov',
         'Dec',
      ])
      expect(graph.every((point) => point.total === 0)).toBe(true)
   })

   it('adds each paid order onto the month it was created in', async () => {
      prismaMock.order.findMany.mockResolvedValue([
         paidOrder(new Date('2024-01-15T00:00:00Z'), 100, []),
         paidOrder(new Date('2024-01-20T00:00:00Z'), 50, []),
         paidOrder(new Date('2024-07-02T00:00:00Z'), 25, []),
         paidOrder(new Date('2024-12-31T00:00:00Z'), 5, []),
      ])

      const graph = await getGraphRevenue()

      expect(graph[0]).toEqual({ name: 'Jan', total: 150 })
      expect(graph[6]).toEqual({ name: 'Jul', total: 25 })
      expect(graph[11]).toEqual({ name: 'Dec', total: 5 })
      expect(graph[3]).toEqual({ name: 'Apr', total: 0 })
   })
})
