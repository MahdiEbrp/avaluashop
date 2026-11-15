import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const URL = process.env.NEXT_PUBLIC_URL

export default async function sitemap() {
   const productRows = await prisma.product.findMany()
   const products = productRows.map(({ id, updatedAt }) => ({
      url: `${URL}/products/${id}`,
      lastModified: updatedAt,
   }))

   const blogRows = await prisma.blog.findMany()
   const blogs = blogRows.map(({ slug, updatedAt }) => ({
      url: `${URL}/blog/${slug}`,
      lastModified: updatedAt,
   }))

   const routes = ['', '/products', '/blog'].map((route) => ({
      url: `${URL}${route}`,
      lastModified: new Date().toISOString(),
   }))

   return [...routes, ...products, ...blogs]
}
