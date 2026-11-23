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

beforeEach(() => { silenceConsole(); })

describe('admin banners', () => {
   it('GET/POST require a session', async () => {
      const bannersGETResult = await bannersGET(get())
      expect(bannersGETResult.status).toBe(401)
      const bannersPOSTResult = await bannersPOST(json({}))
      expect(bannersPOSTResult.status).toBe(401)
   })

   it('GET lists banners newest first', async () => {
      prismaMock.banner.findMany.mockResolvedValue([{ id: 'b1' }])

      const response = await bannersGET(get(USER))

      await expect(response.json()).resolves.toEqual([{ id: 'b1' }])
      expect(prismaMock.banner.findMany).toHaveBeenCalledWith({
         orderBy: { createdAt: 'desc' },
      })
   })

   it('GET list answers 500 on failure (admin banners)', async () => {
      prismaMock.banner.findMany.mockRejectedValue(new Error('down'))

      const bannersGETResult2 = await bannersGET(get(USER))
      expect(bannersGETResult2.status).toBe(500)
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
      const bannerGETResult = await bannerGET(get(), call({ bannerId: 'b1' }))
      expect(bannerGETResult.status).toBe(401)
      const bannerPATCHResult = await bannerPATCH(json({}), call({ bannerId: 'b1' }))
      expect(bannerPATCHResult.status).toBe(401)
      const bannerDELResult = await bannerDEL(get(), call({ bannerId: 'b1' }))
      expect(bannerDELResult.status).toBe(401)
   })

   it('GET returns one banner or 404', async () => {
      prismaMock.banner.findUnique.mockResolvedValue({ id: 'b1' })
      const bannerGETResult2 = await bannerGET(get(USER), call({ bannerId: 'b1' }))
      expect(bannerGETResult2.status).toBe(200)

      prismaMock.banner.findUnique.mockResolvedValue(null)
      const bannerGETResult3 = await bannerGET(get(USER), call({ bannerId: 'nope' }))
      expect(bannerGETResult3.status).toBe(404)
   })

   it('GET by id answers 500 on failure (admin banners)', async () => {
      prismaMock.banner.findUnique.mockRejectedValue(new Error('down'))

      const bannerGETResult4 = await bannerGET(get(USER), call({ bannerId: 'b1' }))
      expect(bannerGETResult4.status).toBe(500)
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
      const bannerPATCHResult2 = await bannerPATCH(json({}, USER), call({ bannerId: 'b1' }))
      expect(bannerPATCHResult2.status).toBe(400)

      prismaMock.banner.findUnique.mockResolvedValue(null)
      const bannerPATCHResult3 = await bannerPATCH(json({ label: 'x' }, USER), call({ bannerId: 'b1' }))
      expect(
         bannerPATCHResult3.status
      ).toBe(404)
   })

   it('PATCH answers 500 on failure', async () => {
      prismaMock.banner.findUnique.mockRejectedValue(new Error('down'))

      const bannerPATCHResult4 = await bannerPATCH(json({ label: 'x' }, USER), call({ bannerId: 'b1' }))
      expect(bannerPATCHResult4.status).toBe(
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

      const bannerDELResult2 = await bannerDEL(get(USER), call({ bannerId: 'x' }))
      expect(bannerDELResult2.status).toBe(404)
   })

   it('DELETE answers 500 on failure', async () => {
      prismaMock.banner.findUnique.mockRejectedValue(new Error('down'))

      const bannerDELResult3 = await bannerDEL(get(USER), call({ bannerId: 'b1' }))
      expect(bannerDELResult3.status).toBe(500)
   })
})

describe('admin brands', () => {
   it('GET and POST require a session', async () => {
      const brandsGETResult = await brandsGET(get())
      expect(brandsGETResult.status).toBe(401)
      const brandsPOSTResult = await brandsPOST(json({}))
      expect(brandsPOSTResult.status).toBe(401)
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

   it('POST answers 409 on duplicate brand and 500 on failure', async () => {
      prismaMock.brand.create.mockRejectedValueOnce({ code: 'P2002' })
      const brandsPOSTResult2 = await brandsPOST(json({ title: 'xx' }, USER))
      expect(brandsPOSTResult2.status).toBe(409)

      prismaMock.brand.create.mockRejectedValueOnce(new Error('down'))
      const brandsPOSTResult3 = await brandsPOST(json({ title: 'xx' }, USER))
      expect(brandsPOSTResult3.status).toBe(500)
   })

   it('GET lists brands', async () => {
      prismaMock.brand.findMany.mockResolvedValue([{ id: 'br1' }])

      const response = await brandsGET(get(USER))

      await expect(response.json()).resolves.toEqual([{ id: 'br1' }])
   })

   it('GET list answers 500 on failure (admin brands)', async () => {
      prismaMock.brand.findMany.mockRejectedValue(new Error('down'))

      const brandsGETResult2 = await brandsGET(get(USER))
      expect(brandsGETResult2.status).toBe(500)
   })

   it('single-brand routes require a session', async () => {
      const brandGETResult = await brandGET(get(), call({ brandId: 'br1' }))
      expect(brandGETResult.status).toBe(401)
      const brandDELResult = await brandDEL(get(), call({ brandId: 'br1' }))
      expect(brandDELResult.status).toBe(401)
      const brandPATCHResult = await brandPATCH(json({ title: 'x' }), call({ brandId: 'br1' }))
      expect(brandPATCHResult.status).toBe(401)
   })

   it('GET returns a brand, 404 when not found, or 400 for a missing id', async () => {
      prismaMock.brand.findUnique.mockResolvedValueOnce({ id: 'br1' })
      const brandGETResult2 = await brandGET(get(USER), call({ brandId: 'br1' }))
      expect(brandGETResult2.status).toBe(200)

      prismaMock.brand.findUnique.mockResolvedValueOnce(null)
      const brandGETResult3 = await brandGET(get(USER), call({ brandId: 'missing' }))
      expect(brandGETResult3.status).toBe(404)

      const brandGETResult4 = await brandGET(get(USER), call({ brandId: '' }))
      expect(brandGETResult4.status).toBe(400)
   })

   it('GET by id answers 500 on failure (admin brands)', async () => {
      prismaMock.brand.findUnique.mockRejectedValue(new Error('down'))

      const brandGETResult5 = await brandGET(get(USER), call({ brandId: 'br1' }))
      expect(brandGETResult5.status).toBe(500)
   })

   it('DELETE removes the brand, blocks linked products, and rejects missing brands or ids', async () => {
      prismaMock.brand.findUnique.mockResolvedValueOnce({ id: 'br1' })
      prismaMock.product.count.mockResolvedValueOnce(0)
      prismaMock.brand.delete.mockResolvedValueOnce({ id: 'br1' })
      const brandDELResult2 = await brandDEL(get(USER), call({ brandId: 'br1' }))
      expect(brandDELResult2.status).toBe(200)

      prismaMock.brand.findUnique.mockResolvedValueOnce(null)
      const brandDELResult3 = await brandDEL(get(USER), call({ brandId: 'missing' }))
      expect(brandDELResult3.status).toBe(404)

      prismaMock.brand.findUnique.mockResolvedValueOnce({ id: 'br1' })
      prismaMock.product.count.mockResolvedValueOnce(2)
      const brandDELResult4 = await brandDEL(get(USER), call({ brandId: 'br1' }))
      expect(brandDELResult4.status).toBe(409)

      const brandDELResult5 = await brandDEL(get(USER), call({ brandId: '' }))
      expect(brandDELResult5.status).toBe(400)
   })

   it('DELETE answers 500 on failure', async () => {
      prismaMock.brand.findUnique.mockResolvedValue({ id: 'br1' })
      prismaMock.product.count.mockResolvedValue(0)
      prismaMock.brand.delete.mockRejectedValue(new Error('down'))

      const brandDELResult6 = await brandDEL(get(USER), call({ brandId: 'br1' }))
      expect(brandDELResult6.status).toBe(500)
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
      const brandPATCHResult2 = await brandPATCH(json({}, USER), call({ brandId: 'br1' }))
      expect(brandPATCHResult2.status).toBe(400)
      const brandPATCHResult3 = await brandPATCH(json({ title: 'x' }, USER), call({ brandId: '' }))
      expect(
         brandPATCHResult3.status
      ).toBe(400)
   })

   it('PATCH answers 404 on P2025, 409 on P2002, and 500 on failure', async () => {
      prismaMock.brand.update.mockRejectedValueOnce({ code: 'P2025' })
      const brandPATCHResult4 = await brandPATCH(json({ title: 'xx' }, USER), call({ brandId: 'br1' }))
      expect(brandPATCHResult4.status).toBe(404)

      prismaMock.brand.update.mockRejectedValueOnce({ code: 'P2002' })
      const brandPATCHResult5 = await brandPATCH(json({ title: 'xx' }, USER), call({ brandId: 'br1' }))
      expect(brandPATCHResult5.status).toBe(409)

      prismaMock.brand.update.mockRejectedValueOnce(new Error('down'))
      const brandPATCHResult6 = await brandPATCH(json({ title: 'xx' }, USER), call({ brandId: 'br1' }))
      expect(brandPATCHResult6.status).toBe(500)
   })
})

describe('admin categories', () => {
   it('GET and POST require a session and a valid title', async () => {
      const categoriesGETResult = await categoriesGET(get())
      expect(categoriesGETResult.status).toBe(401)
      const categoriesPOSTResult = await categoriesPOST(json({}))
      expect(categoriesPOSTResult.status).toBe(401)
      const categoriesPOSTResult2 = await categoriesPOST(json({}, USER))
      expect(categoriesPOSTResult2.status).toBe(400)
      const categoriesPOSTResult3 = await categoriesPOST(json({ title: 'Shoes' }, USER))
      expect(categoriesPOSTResult3.status).toBe(201)
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

   it('POST answers 409 on duplicate category and 500 on failure', async () => {
      prismaMock.category.create.mockRejectedValueOnce({ code: 'P2002' })
      const categoriesPOSTResult4 = await categoriesPOST(json({ title: 'xx' }, USER))
      expect(categoriesPOSTResult4.status).toBe(409)

      prismaMock.category.create.mockRejectedValueOnce(new Error('down'))
      const categoriesPOSTResult5 = await categoriesPOST(json({ title: 'xx' }, USER))
      expect(categoriesPOSTResult5.status).toBe(500)
   })

   it('GET lists categories', async () => {
      prismaMock.category.findMany.mockResolvedValue([{ id: 'c1' }])

      const categoriesGETResult2 = await categoriesGET(get(USER))
      await expect(categoriesGETResult2.json()).resolves.toEqual([{ id: 'c1' }])
   })

   it('GET list answers 500 on failure (admin categories)', async () => {
      prismaMock.category.findMany.mockRejectedValue(new Error('down'))

      const categoriesGETResult3 = await categoriesGET(get(USER))
      expect(categoriesGETResult3.status).toBe(500)
   })

   it('single-category routes require a session', async () => {
      const categoryGETResult = await categoryGET(get(), call({ categoryId: 'c1' }))
      expect(categoryGETResult.status).toBe(401)
      const categoryDELResult = await categoryDEL(get(), call({ categoryId: 'c1' }))
      expect(categoryDELResult.status).toBe(401)
      const categoryPATCHResult = await categoryPATCH(json({}), call({ categoryId: 'c1' }))
      expect(categoryPATCHResult.status).toBe(401)
   })

   it('GET returns the category, 404 when missing, or 400 for an empty id', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce({ id: 'c1' })
      const categoryGETResult2 = await categoryGET(get(USER), call({ categoryId: 'c1' }))
      expect(categoryGETResult2.status).toBe(200)

      prismaMock.category.findUnique.mockResolvedValueOnce(null)
      const categoryGETResult3 = await categoryGET(get(USER), call({ categoryId: 'missing' }))
      expect(categoryGETResult3.status).toBe(404)

      const categoryGETResult4 = await categoryGET(get(USER), call({ categoryId: '' }))
      expect(categoryGETResult4.status).toBe(400)
   })

   it('GET by id answers 500 on failure (admin categories)', async () => {
      prismaMock.category.findUnique.mockRejectedValue(new Error('down'))

      const categoryGETResult5 = await categoryGET(get(USER), call({ categoryId: 'c1' }))
      expect(categoryGETResult5.status).toBe(500)
   })

   it('DELETE removes an unused category, blocks linked products, and rejects missing categories or ids', async () => {
      prismaMock.category.findUnique.mockResolvedValueOnce({ id: 'c1' })
      prismaMock.product.count.mockResolvedValueOnce(0)
      prismaMock.category.delete.mockResolvedValueOnce({ id: 'c1' })
      const categoryDELResult2 = await categoryDEL(get(USER), call({ categoryId: 'c1' }))
      expect(categoryDELResult2.status).toBe(200)

      prismaMock.category.findUnique.mockResolvedValueOnce(null)
      const categoryDELResult3 = await categoryDEL(get(USER), call({ categoryId: 'missing' }))
      expect(categoryDELResult3.status).toBe(404)

      prismaMock.category.findUnique.mockResolvedValueOnce({ id: 'c1' })
      prismaMock.product.count.mockResolvedValueOnce(1)
      const categoryDELResult4 = await categoryDEL(get(USER), call({ categoryId: 'c1' }))
      expect(categoryDELResult4.status).toBe(409)

      const categoryDELResult5 = await categoryDEL(get(USER), call({ categoryId: '' }))
      expect(categoryDELResult5.status).toBe(400)
   })

   it('DELETE answers 500 on failure', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'c1' })
      prismaMock.product.count.mockResolvedValue(0)
      prismaMock.category.delete.mockRejectedValue(new Error('down'))

      const categoryDELResult6 = await categoryDEL(get(USER), call({ categoryId: 'c1' }))
      expect(categoryDELResult6.status).toBe(500)
   })

   it('PATCH rejects an empty patch and a missing id', async () => {
      const categoryPATCHResult2 = await categoryPATCH(json({}, USER), call({ categoryId: 'c1' }))
      expect(categoryPATCHResult2.status).toBe(400)
      const categoryPATCHResult3 = await categoryPATCH(json({ title: 'x' }, USER), call({ categoryId: '' }))
      expect(categoryPATCHResult3.status).toBe(400)
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

   it('PATCH answers 404 on P2025, 409 on P2002, and 500 on failure', async () => {
      prismaMock.category.update.mockRejectedValueOnce({ code: 'P2025' })
      const categoryPATCHResult4 = await categoryPATCH(json({ title: 'xx' }, USER), call({ categoryId: 'c1' }))
      expect(categoryPATCHResult4.status).toBe(404)

      prismaMock.category.update.mockRejectedValueOnce({ code: 'P2002' })
      const categoryPATCHResult5 = await categoryPATCH(json({ title: 'xx' }, USER), call({ categoryId: 'c1' }))
      expect(categoryPATCHResult5.status).toBe(409)

      prismaMock.category.update.mockRejectedValueOnce(new Error('down'))
      const categoryPATCHResult6 = await categoryPATCH(json({ title: 'xx' }, USER), call({ categoryId: 'c1' }))
      expect(categoryPATCHResult6.status).toBe(500)
   })
})
