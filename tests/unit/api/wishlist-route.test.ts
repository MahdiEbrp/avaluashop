import { GET, POST, DELETE } from '@/app/api/wishlist/route'
import { prismaMock } from '../support/db'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

describe('wishlist API', () => {
   it('requires an authenticated user for reads', async () => {
      const response = await GET(new Request('http://localhost/api/wishlist'))

      expect(response.status).toBe(401)
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
   })

   it('returns only display-safe product fields and private cache headers', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
         wishlist: [{ id: 'p1', title: 'گردنبند', brand: { id: 'b1', title: 'آوالونا' }, categories: [] }],
      })

      const response = await GET(new Request('http://localhost/api/wishlist', {
         headers: { 'X-USER-ID': 'user-1' },
      }))

      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
         where: { id: 'user-1' },
         select: {
            wishlist: {
               select: expect.objectContaining({
                  id: true,
                  title: true,
                  images: true,
                  brand: { select: { id: true, title: true } },
               }),
            },
         },
      })
   })

   it('rejects malformed mutation bodies before querying products', async () => {
      const response = await POST(new Request('http://localhost/api/wishlist', {
         method: 'POST',
         headers: { 'X-USER-ID': 'user-1', 'Content-Type': 'application/json' },
         body: JSON.stringify({ productId: { forged: true } }),
      }))

      expect(response.status).toBe(400)
      expect(prismaMock.product.findUnique).not.toHaveBeenCalled()
   })

   it('returns not found when a product to remove does not exist', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null)

      const response = await DELETE(new Request('http://localhost/api/wishlist', {
         method: 'DELETE',
         headers: { 'X-USER-ID': 'user-1', 'Content-Type': 'application/json' },
         body: JSON.stringify({ productId: 'missing' }),
      }))

      expect(response.status).toBe(404)
      expect(prismaMock.user.update).not.toHaveBeenCalled()
   })
})
