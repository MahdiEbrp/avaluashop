import ConsCard from '@/components/native/mdx/ConsCard'
import ProsCard from '@/components/native/mdx/ProsCard'
import Step from '@/components/native/mdx/Step'
import Image from 'next/image'

function MDXImage({ alt, src }) {
   return (
      <div className="my-6 w-full">
         <Image
            alt={alt}
            className="mx-auto rounded-lg"
            src={src}
            fill
            sizes="(min-width: 1000px) 30vw, 50vw"
         />
      </div>
   )
}

function Callout(props) {
   return (
      <div className="my-8 flex rounded-lg bg-muted p-4">
         <div className="mr-4 flex w-4 items-center">{props.emoji}</div>
         <div className="w-full">{props.children}</div>
      </div>
   )
}

function Header({ title }: Readonly<{ title: string }>) {
   return (
      <h2 className="mt-8 scroll-m-20 text-2xl font-semibold tracking-tight">
         {title}
      </h2>
   )
}

const MDXComponents = {
   MDXImage,
   Callout,
   ConsCard,
   ProsCard,
   Step,
   Header,
}

export default MDXComponents
