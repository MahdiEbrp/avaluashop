import { Separator } from '@/components/native/separator'
import config from '@/config/site'
import { InstagramLogoIcon, GitHubLogoIcon } from '@radix-ui/react-icons'
import Link from 'next/link'

const data = [
   { label: 'راهنمای خرید', links: [{ label: 'سوالات متداول', url: '/faq' }, { label: 'شرایط و قوانین', url: '/terms' }, { label: 'حریم خصوصی', url: '/privacy' }] },
   { label: 'آوالوا', links: [{ label: 'درباره ما', url: '/about' }, { label: 'مجله', url: '/blog' }, { label: 'تماس با ما', url: '/contact' }] },
   { label: 'پشتیبانی', links: [{ label: 'پیگیری سفارش', url: '/profile/orders' }, { label: 'ارتباط با ما', url: '/contact' }] },
]

export default function Footer() {
   return (
      <footer className="mt-12 w-full bg-secondary/60">
         <Separator />
         <div className="grid gap-10 px-5 py-10 md:grid-cols-[1.2fr_2fr] md:px-16 lg:px-24 xl:px-32 2xl:px-48">
            <Trademark />
            <Links />
         </div>
         <Separator />
         <Socials />
      </footer>
   )
}

function Links() {
   return (
      <div className="grid grid-cols-2 gap-7 text-end sm:grid-cols-3">
         {data.map(({ label, links }) => (
            <div key={label}>
               <h2 className="mb-3 text-sm font-bold text-foreground">{label}</h2>
               <ul className="space-y-2">
                  {links.map(({ label, url }) => (
                     <li key={label}>
                        <Link href={url} className="text-sm text-muted-foreground transition-colors hover:text-primary">{label}</Link>
                     </li>
                  ))}
               </ul>
            </div>
         ))}
      </div>
   )
}

function Trademark() {
   return (
      <div className="text-right">
         <h2 className="text-lg font-bold text-foreground">{config.name}</h2>
         <p className="mt-2 max-w-sm text-sm leading-7 text-muted-foreground">تجربه‌ای دلنشین از انتخاب و خرید آنلاین؛ همراه شما برای خریدی آسان و مطمئن.</p>
         <span className="mt-4 block text-xs text-muted-foreground">© {new Date().getFullYear()} {config.name} — تمامی حقوق محفوظ است.</span>
      </div>
   )
}

function Socials() {
   return (
      <div className="flex justify-center gap-6 py-5 text-muted-foreground">
         <a href="https://instagram.com/avaluashop" target="_blank" rel="noreferrer" aria-label="اینستاگرام آوالوا"><InstagramLogoIcon className="h-5 w-5 transition-colors hover:text-primary" /></a>
         <a href="https://github.com/avaluashop" target="_blank" rel="noreferrer" aria-label="گیت‌هاب"><GitHubLogoIcon className="h-5 w-5 transition-colors hover:text-primary" /></a>
      </div>
   )
}
