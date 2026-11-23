import { Separator } from '@/components/native/separator'
import config from '@/config/site'
import { InstagramLogoIcon } from '@radix-ui/react-icons'
import Link from 'next/link'

const groups = [
   {
      title: 'راهنمای خرید',
      links: [
         { title: 'سوالات متداول', href: '/faq' },
         { title: 'شرایط و قوانین', href: '/terms' },
         { title: 'حریم خصوصی', href: '/privacy' },
      ],
   },
   {
      title: 'آوالونا شاپ',
      links: [
         { title: 'درباره ما', href: '/about' },
         { title: 'تماس با ما', href: '/contact' },
      ],
   },
   {
      title: 'پشتیبانی',
      links: [{ title: 'پیگیری سفارش', href: '/profile/orders' }],
   },
]

export default function Footer() {
   return (
      <footer className="mt-12 w-full bg-secondary/60" dir="rtl">
         <Separator />
         <div className="grid gap-10 px-5 py-10 md:grid-cols-8 md:px-16 lg:px-24 xl:px-32 2xl:px-48">
            <div className="text-right md:col-span-3">
               <h2 className="text-lg font-bold text-foreground">{config.name}</h2>
               <p className="mt-2 max-w-sm text-sm leading-7 text-muted-foreground">
                  اکسسوری‌های ظریف برای کامل‌کردن استایل شما؛ با انتخابی ساده و خریدی مطمئن.
               </p>
               <span className="mt-4 block text-xs text-muted-foreground">
                  © {new Date().getFullYear()} {config.name} — تمامی حقوق محفوظ است.
               </span>
            </div>
            <div className="grid grid-cols-2 gap-7 text-right sm:grid-cols-3 md:col-span-5">
               {groups.map((group) => (
                  <div key={group.title}>
                     <h2 className="mb-3 text-sm font-bold text-foreground">{group.title}</h2>
                     <ul className="space-y-2">
                        {group.links.map((link) => (
                           <li key={link.href}>
                              <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                                 {link.title}
                              </Link>
                           </li>
                        ))}
                     </ul>
                  </div>
               ))}
            </div>
         </div>
         <Separator />
         <div className="flex justify-center py-5 text-muted-foreground">
            <a href={config.links.instagram} target="_blank" rel="noreferrer" aria-label="اینستاگرام آوالونا شاپ">
               <InstagramLogoIcon className="h-5 w-5 transition-colors hover:text-primary" />
            </a>
         </div>
      </footer>
   )
}
