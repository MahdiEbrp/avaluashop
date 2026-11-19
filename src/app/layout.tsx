import { ModalProvider } from '@/providers/modal-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { Baloo_Bhaijaan_2 } from 'next/font/google'

import './globals.css'

const baloo = Baloo_Bhaijaan_2({
   subsets: ['arabic', 'latin'],
   display: 'swap',
   variable: '--font-baloo',
})

export const metadata = {
   title: {
      default: 'آوالونا شاپ | فروشگاه اکسسوری زنانه',
      template: '%s | آوالونا شاپ',
   },
   description:
      'فروشگاه آنلاین اکسسوری زنانه آوالونا شاپ؛ انتخابی ظریف برای استایل روزمره و خاص شما.',
   keywords: ['آوالونا شاپ', 'اکسسوری زنانه', 'زیورآلات', 'کیف زنانه', 'اکسسوری مو'],
   authors: [{ name: 'آوالونا شاپ', url: 'https://avaluashop.vercel.app' }],
   creator: 'آوالونا شاپ',
   publisher: 'آوالونا شاپ',
   metadataBase: new URL('https://avaluashop.vercel.app'),
}

export default function RootLayout({
   children,
}: Readonly<{
   children: React.ReactNode
}>) {
   return (
      <html lang="fa" dir="rtl" suppressHydrationWarning>
         <body className={`${baloo.variable} font-sans antialiased`}>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
               <ToastProvider />
               <ModalProvider />
               {children}
            </ThemeProvider>
         </body>
      </html>
   )
}
