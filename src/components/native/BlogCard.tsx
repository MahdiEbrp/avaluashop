import { ImageSkeleton } from '@/components/native/icons'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import Image from 'next/image'
import Link from 'next/link'

export interface BlogPost {
   title: string
   image: string
   slug: string
   author?: { name: string } | null
}

export function BlogPostGrid({ blogs }: Readonly<{ blogs: BlogPost[] }>) {
   return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
         {blogs.map((post: BlogPost) => (
            <BlogPostCard key={post.slug} post={post} />
         ))}
      </div>
   )
}

export function BlogPostSkeletonGrid() {
   return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
         {Array.from({ length: 3 }).map((_, i) => (
            <BlogPostSkeleton key={i} />
         ))}
      </div>
   )
}

export function BlogPostCard({ post }: Readonly<{ post: BlogPost }>) {
   const { title, image, slug, author } = post

   return (
      <Link href={`/blog/${slug}`}>
         <Card className="h-full">
            <CardHeader className="p-0">
               <div className="relative h-60 w-full">
                  <Image
                     className="rounded-t-lg object-cover"
                     src={image}
                     alt="product image"
                     fill
                     sizes="(min-width: 1000px) 30vw, 50vw"
                  />
               </div>
            </CardHeader>
            <CardContent className="grid gap-4 p-4">
               <h5 className="">{title}</h5>
            </CardContent>
            <CardFooter>
               <p className="block text-sm text-foreground dark:text-muted-foreground">
                  <span>{author?.name}</span>
               </p>
            </CardFooter>
         </Card>
      </Link>
   )
}

export const BlogPostSkeleton = () => {
   return (
      <Link href="#">
         <div className="animate-pulse rounded-lg border border-border bg-card">
            <div className="relative h-full w-full">
               <div className="flex h-40 w-full items-center justify-center rounded bg-muted ">
                  <ImageSkeleton />
               </div>
            </div>
            <div className="p-5">
               <div className="w-full">
                  <div className="mb-4 h-2.5 w-48 rounded-full bg-muted"></div>
                  <div className="mb-2.5 h-2 max-w-120 rounded-full bg-muted"></div>
                  <div className="mb-2.5 h-2 rounded-full bg-muted"></div>
                  <div className="mb-2.5 h-2 max-w-110 rounded-full bg-muted"></div>
                  <div className="mb-2.5 h-2 max-w-115 rounded-full bg-muted"></div>
                  <div className="h-2 max-w-90 rounded-full bg-muted"></div>
               </div>
            </div>
         </div>
      </Link>
   )
}
