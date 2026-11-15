import { ModalProvider } from '@/providers/modal-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { Baloo_Bhaijaan_2 } from 'next/font/google'

import './globals.css'

// Baloo Bhaijaan 2 — Persian/Arabic + Latin glyphs, variable weight 400–800.
const baloo = Baloo_Bhaijaan_2({
   subsets: ['arabic', 'latin'],
   display: 'swap',
   variable: '--font-baloo',
})

export const metadata = {
   title: {
      default: 'AvaluaShop — فروشگاه اینترنتی آوالواشاپ',
      template: '%s | AvaluaShop',
   },
   description:
      'فروشگاه اینترنتی آوالواشاپ — خرید آنلاین با طراحی مدرن، پرداخت امن و ارسال سریع.',
   keywords: ['AvaluaShop', 'آوالواشاپ', 'فروشگاه اینترنتی', 'خرید آنلاین'],
   authors: [{ name: 'AvaluaShop', url: 'https://avaluashop.com' }],
   creator: 'AvaluaShop',
   publisher: 'AvaluaShop',
   metadataBase: new URL('https://avaluashop.vercel.app'),
}

export default function RootLayout({
   children,
}: Readonly<{
   children: React.ReactNode
}>) {
   return (
      <html lang="fa" dir="rtl">
         <body className={`${baloo.variable} font-sans antialiased`}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
               <ToastProvider />
               <ModalProvider />
               {children}
            </ThemeProvider>
         </body>
      </html>
   )
}
