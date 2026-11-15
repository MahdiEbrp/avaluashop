import MDXComponents from '@/components/native/mdx/MDXComponents'
import { Separator } from '@/components/native/separator'
import prisma from '@/lib/prisma'
import { MDXRemote } from 'next-mdx-remote'
import { serialize } from 'next-mdx-remote/serialize'
import Image from 'next/image'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Blog({
   params,
}: Readonly<{
   params: Promise<{ slug: string }>
}>) {
   const { slug } = await params

   const blog = await prisma.blog.findUnique({
      where: {
         slug,
      },
      include: { author: true },
   })

   const recommendations = await prisma.blog.findMany({
      include: { author: true },
      take: 3,
   })

   const mdx = await serialize(blog.content)

   return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
         <Content blog={blog} mdx={mdx} />
         <Recomendations recommendations={recommendations} />
      </div>
   )
}

function Content({ blog, mdx }) {
   const { title } = blog

   return (
      <div className="rounded-lg bg-card p-6 text-justify text-card-foreground md:col-span-3">
         <h1 className="mb-1 text-3xl font-medium">{title}</h1>
         <p className="mt-2 text-sm font-medium text-muted-foreground">
            Last Updated @Date
         </p>
         <Separator />
         <MDXRemote lazy {...mdx} components={MDXComponents} />
      </div>
   )
}

function Recomendations({ recommendations }) {
   return (
      <div className="col-span-1">
         {recommendations.map((rec) => {
            const { slug, author, title, image } = rec

            return (
               <div key={rec} className="mb-4 w-full">
                  <Link href={`/blog/${String(slug)}`}>
                     <div className="w-full rounded-lg border border-border bg-card">
                        <div className="relative h-40 w-full">
                           <Image
                              className="rounded-t-lg object-cover"
                              src={image}
                              alt="Blog Post Cover"
                              fill
                              sizes="(min-width: 1000px) 30vw, 50vw"
                           />
                        </div>
                        <div className="p-5">
                           <div className="w-full">
                              <h5 className="mb-3 text-justify font-medium tracking-tight text-foreground dark:text-white">
                                 {title}
                              </h5>
                              <p className="block text-sm text-foreground dark:text-muted-foreground">
                                 <span>{author?.name}, Date</span>
                              </p>
                           </div>
                        </div>
                     </div>
                  </Link>
               </div>
            )
         })}
      </div>
   )
}
