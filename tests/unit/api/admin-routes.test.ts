import {
   GET as bannersGET,
   POST as bannersPOST,
} from '@/app/api/admin/banners/route'
import {
   DELETE as bannerDEL,
   GET as bannerGET,
   PATCH as bannerPATCH,
} from '@/app/api/admin/banners/[bannerId]/route'
import { GET as brandsGET, POST as brandsPOST } from '@/app/api/admin/brands/route'
import {
   DELETE as brandDEL,
   GET as brandGET,
   PATCH as brandPATCH,
} from '@/app/api/admin/brands/[brandId]/route'
import {
   GET as categoriesGET,
   POST as categoriesPOST,
} from '@/app/api/admin/categories/route'
import {
   DELETE as categoryDEL,
   GET as categoryGET,
   PATCH as categoryPATCH,
} from '@/app/api/admin/categories/[categoryId]/route'
import { revalidateTag, revalidatePath } from 'next/cache'

import { call, get, json, prismaMock, silenceConsole, USER } from './helpers'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))
vi.mock('next/cache', () => import('../support/cache'))

beforeEach(() => silenceConsole())

describe('admin banners', () => {
   it('GET/POST require a session', async () => {
      expect((await bannersGET(get())).status).toBe(401)
      expect((await bannersPOST(json({}))).status).toBe(401)
   })

   it('GET lists banners newest first', async () => {
      prismaMock.banner.findMany.mockResolvedValue([{ id: 'b1' }])

      const response = await bannersGET(get(USER))

      await expect(response.json()).resolves.toEqual([{ id: 'b1' }])
      expect(prismaMock.banner.findMany).toHaveBeenCalledWith({
         orderBy: { createdAt: 'desc' },
      })
   })

   it('GET answers 500 on failure', async () => {
      prismaMock.banner.findMany.mockRejectedValue(new Error('down'))

      expect((await bannersGET(get(USER))).status).toBe(500)
   })

   it('POST validates, creates and revalidates the home page', async () => {
      prismaMock.banner.create.mockResolvedValue({ id: 'b2' })

      const response = await bannersPOST(
         json({ label: 'Sale', image: '/sale.png' }, USER)
      )

      expect(response.status).toBe(200)
      expect(prismaMock.banner.create).toHaveBeenCalledWith({
         data: { label: 'Sale', image: '/sale.png' },
      })
      expect(revalidatePath).toHaveBeenCalledWith('/')
   })

   it('POST rejects an invalid body with 400', async () => {
      const response = await bannersPOST(json({ label: '', image: '' }, USER))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ message: 'INVALID BANNER' })
   })

   it('POST answers 500 on a database failure', async () => {
      prismaMock.banner.create.mockRejectedValue(new Error('down'))

      const response = await bannersPOST(json({ label: 'x', image: 'y' }, USER))

      expect(response.status).toBe(500)
   })

   it('banner routes require a session', async () => {
      expect((await bannerGET(get(), call({ bannerId: 'b1' }))).status).toBe(401)
      expect((await bannerPATCH(json({}), call({ bannerId: 'b1' }))).status).toBe(401)
      expect((await bannerDEL(get(), call({ bannerId: 'b1' }))).status).toBe(401)
   })

   it('GET returns one banner or 404', async () => {
      prismaMock.banner.findUnique.mockResolvedValue({ id: 'b1' })
      expect((await bannerGET(get(USER), call({ bannerId: 'b1' }))).status).toBe(200)

      prismaMock.banner.findUnique.mockResolvedValue(null)
      expect((await bannerGET(get(USER), call({ bannerId: 'nope' }))).status).toBe(404)
   })

   it('GET answers 500 on failure', async () => {
      prismaMock.banner.findUnique.mockRejectedValue(new Error('down'))

      expect((await bannerGET(get(USER), call({ bannerId: 'b1' }))).status).toBe(500)
   })

   it('PATCH validates, checks existence, updates and revalidates', async () => {
      prismaMock.banner.findUnique.mockResolvedValue({ id: 'b1' })
      prismaMock.banner.update.mockResolvedValue({ id: 'b1', label: 'New' })

      const response = await bannerPATCH(json({ label: 'New' }, USER), call({ bannerId: 'b1' }))

      expect(response.status).toBe(200)
      expect(prismaMock.banner.update).toHaveBeenCalledWith({
         where: { id: 'b1' },
         data: { label: 'New' },
      })
      expect(revalidatePath).toHaveBeenCalledWith('/')
   })

   it('PATCH rejects an empty patch and a missing banner', async () => {
      expect((await bannerPATCH(json({}, USER), call({ bannerId: 'b1' }))).status).toBe(400)

      prismaMock.banner.findUnique.mockResolvedValue(null)
      expect(
         (await bannerPATCH(json({ label: 'x' }, USER), call({ bannerId: 'b1' }))).status
      ).toBe(404)
   })

   it('PATCH answers 500 on failure', async () => {
      prismaMock.banner.findUnique.mockRejectedValue(new Error('down'))

      expect((await bannerPATCH(json({ label: 'x' }, USER), call({ bannerId: 'b1' }))).status).toBe(
         500
      )
   })

   it('DELETE detaches categories, deletes and revalidates', async () => {
      prismaMock.banner.findUnique.mockResolvedValue({ id: 'b1' })
      prismaMock.banner.update.mockResolvedValue({})
      prismaMock.banner.delete.mockResolvedValue({ id: 'b1' })

      const response = await bannerDEL(get(USER), call({ bannerId: 'b1' }))

      expect(response.status).toBe(200)
      expect(prismaMock.banner.update).toHaveBeenCalledWith({
         where: { id: 'b1' },
         data: { categories: { set: [] } },
      })
      expect(prismaMock.banner.delete).toHaveBeenCalledWith({ where: { id: 'b1' } })
      expect(revalidatePath).toHaveBeenCalledWith('/')
   })

   it('DELETE answers 404 for a missing banner', async () => {
      prismaMock.banner.findUnique.mockResolvedValue(null)

      expect((await bannerDEL(get(USER), call({ bannerId: 'x' }))).status).toBe(404)
   })

   it('DELETE answers 500 on failure', async () => {
      prismaMock.banner.findUnique.mockRejectedValue(new Error('down'))

      expect((await bannerDEL(get(USER), call({ bannerId: 'b1' }))).status).toBe(500)
   })
})

describe('admin brands', () => {
   it('POST requires a session', async () => {
      expect((await brandsPOST(json({}))).status).toBe(401)
   })

   it('POST requires a title', async () => {
      const response = await brandsPOST(json({}, USER))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ message: 'INVALID_BRAND' })
   })

   it('POST creates and invalidates the catalogue tag', async () => {
      prismaMock.brand.create.mockResolvedValue({ id: 'br1' })

      const response = await brandsPOST(
         json({ title: 'Acme', description: 'd', logo: '/l.png' }, USER)
      )

      expect(response.status).toBe(201)
      expect(revalidateTag).toHaveBeenCalledWith('catalog', { expire: 0 })
   })

   it('POST answers 500 on failure', async () => {
      prismaMock.brand.create.mockRejectedValue(new Error('down'))

      expect((await brandsPOST(json({ title: 'x' }, USER))).status).toBe(500)
   })

   it('GET lists brands', async () => {
      prismaMock.brand.findMany.mockResolvedValue([{ id: 'br1' }])

      const response = await brandsGET(get(USER))

      await expect(response.json()).resolves.toEqual([{ id: 'br1' }])
   })

   it('GET answers 500 on failure', async () => {
      prismaMock.brand.findMany.mockRejectedValue(new Error('down'))

      expect((await brandsGET(get(USER))).status).toBe(500)
   })

   it('single-brand routes require a session', async () => {
      expect((await brandGET(get(), call({ brandId: 'br1' }))).status).toBe(401)
      expect((await brandDEL(get(), call({ brandId: 'br1' }))).status).toBe(401)
      expect((await brandPATCH(json({ title: 'x' }), call({ brandId: 'br1' }))).status).toBe(401)
   })

   it('GET returns a brand or 400 for a missing id', async () => {
      prismaMock.brand.findUnique.mockResolvedValue({ id: 'br1' })

      expect((await brandGET(get(USER), call({ brandId: 'br1' }))).status).toBe(200)
      expect((await brandGET(get(USER), call({ brandId: '' }))).status).toBe(400)
   })

   it('GET answers 500 on failure', async () => {
      prismaMock.brand.findUnique.mockRejectedValue(new Error('down'))

      expect((await brandGET(get(USER), call({ brandId: 'br1' }))).status).toBe(500)
   })

   it('DELETE removes the brand and rejects a missing id', async () => {
      prismaMock.brand.findUnique.mockResolvedValue({ id: 'br1' })
      prismaMock.product.count.mockResolvedValue(0)
      prismaMock.brand.delete.mockResolvedValue({ id: 'br1' })

      expect((await brandDEL(get(USER), call({ brandId: 'br1' }))).status).toBe(200)
      expect((await brandDEL(get(USER), call({ brandId: '' }))).status).toBe(400)
   })

   it('DELETE answers 500 on failure', async () => {
      prismaMock.brand.findUnique.mockResolvedValue({ id: 'br1' })
      prismaMock.product.count.mockResolvedValue(0)
      prismaMock.brand.delete.mockRejectedValue(new Error('down'))

      expect((await brandDEL(get(USER), call({ brandId: 'br1' }))).status).toBe(500)
   })

   it('PATCH updates only the fields provided', async () => {
      prismaMock.brand.update.mockResolvedValue({ id: 'br1' })

      const response = await brandPATCH(json({ title: 'New' }, USER), call({ brandId: 'br1' }))

      expect(response.status).toBe(200)
      expect(prismaMock.brand.update).toHaveBeenCalledWith({
         where: { id: 'br1' },
         data: { title: 'New' },
      })
   })

   it('PATCH accepts a description-only edit', async () => {
      prismaMock.brand.update.mockResolvedValue({ id: 'br1' })

      await brandPATCH(json({ description: 'd' }, USER), call({ brandId: 'br1' }))

      expect(prismaMock.brand.update).toHaveBeenCalledWith({
         where: { id: 'br1' },
         data: { description: 'd' },
      })
   })

   it('PATCH rejects an empty body and a missing id', async () => {
      expect((await brandPATCH(json({}, USER), call({ brandId: 'br1' }))).status).toBe(400)
      expect(
         (await brandPATCH(json({ title: 'x' }, USER), call({ brandId: '' }))).status
      ).toBe(400)
   })

   it('PATCH answers 500 on failure', async () => {
      prismaMock.brand.update.mockRejectedValue(new Error('down'))

      expect((await brandPATCH(json({ title: 'x' }, USER), call({ brandId: 'br1' }))).status).toBe(
         500
      )
   })
})

describe('admin categories', () => {
   it('POST requires a session and a valid title', async () => {
      expect((await categoriesPOST(json({}))).status).toBe(401)
      expect((await categoriesPOST(json({}, USER))).status).toBe(400)
      expect((await categoriesPOST(json({ title: 'Shoes' }, USER))).status).toBe(201)
   })

   it('POST creates the category with its banner', async () => {
      prismaMock.category.create.mockResolvedValue({ id: 'c1' })

      const response = await categoriesPOST(
         json({ title: 'Shoes', description: 'd', bannerId: 'b1' }, USER)
      )

      expect(response.status).toBe(201)
      expect(prismaMock.category.create).toHaveBeenCalledWith({
         data: { title: 'Shoes', description: 'd' },
      })
   })

   it('POST answers 500 on failure', async () => {
      prismaMock.category.create.mockRejectedValue(new Error('down'))

      expect(
         (await categoriesPOST(json({ title: 'x' }, USER))).status
      ).toBe(500)
   })

   it('GET lists categories', async () => {
      prismaMock.category.findMany.mockResolvedValue([{ id: 'c1' }])

      await expect((await categoriesGET(get(USER))).json()).resolves.toEqual([{ id: 'c1' }])
   })

   it('GET answers 500 on failure', async () => {
      prismaMock.category.findMany.mockRejectedValue(new Error('down'))

      expect((await categoriesGET(get(USER))).status).toBe(500)
   })

   it('single-category routes require a session', async () => {
      expect((await categoryGET(get(), call({ categoryId: 'c1' }))).status).toBe(401)
      expect((await categoryDEL(get(), call({ categoryId: 'c1' }))).status).toBe(401)
      expect((await categoryPATCH(json({}), call({ categoryId: 'c1' }))).status).toBe(401)
   })

   it('GET returns the category or 400 for a missing id', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'c1' })

      expect((await categoryGET(get(USER), call({ categoryId: 'c1' }))).status).toBe(200)
      expect((await categoryGET(get(USER), call({ categoryId: '' }))).status).toBe(400)
   })

   it('GET answers 500 on failure', async () => {
      prismaMock.category.findUnique.mockRejectedValue(new Error('down'))

      expect((await categoryGET(get(USER), call({ categoryId: 'c1' }))).status).toBe(500)
   })

   it('DELETE removes an unused category and rejects a missing id', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'c1' })
      prismaMock.product.count.mockResolvedValue(0)
      prismaMock.category.delete.mockResolvedValue({ id: 'c1' })

      expect((await categoryDEL(get(USER), call({ categoryId: 'c1' }))).status).toBe(200)
      expect((await categoryDEL(get(USER), call({ categoryId: '' }))).status).toBe(400)
   })

   it('DELETE answers 500 on failure', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'c1' })
      prismaMock.product.count.mockResolvedValue(0)
      prismaMock.category.delete.mockRejectedValue(new Error('down'))

      expect((await categoryDEL(get(USER), call({ categoryId: 'c1' }))).status).toBe(500)
   })

   it('PATCH rejects an empty patch and a missing id', async () => {
      expect((await categoryPATCH(json({}, USER), call({ categoryId: 'c1' }))).status).toBe(400)
      expect((await categoryPATCH(json({ title: 'x' }, USER), call({ categoryId: '' }))).status).toBe(400)
   })

   it('PATCH updates the category', async () => {
      prismaMock.category.update.mockResolvedValue({ id: 'c1' })

      const response = await categoryPATCH(
         json({ title: 'New', description: 'd' }, USER),
         call({ categoryId: 'c1' })
      )

      expect(response.status).toBe(200)
      expect(prismaMock.category.update).toHaveBeenCalledWith({
         where: { id: 'c1' },
         data: { title: 'New', description: 'd' }, 
      })
   })

   it('PATCH answers 500 on failure', async () => {
      prismaMock.category.update.mockRejectedValue(new Error('down'))

      expect(
         (
            await categoryPATCH(
               json({ title: 'x' }, USER),
               call({ categoryId: 'c1' })
            )
         ).status
      ).toBe(500)
   })
})
