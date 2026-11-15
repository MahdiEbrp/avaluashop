import Footer from '@/components/native/Footer'
import Header from '@/components/native/nav/parent'

export default function DashboardLayout({
   children,
}: Readonly<{
   children: React.ReactNode
}>) {
   return (
      <>
         <Header />
         <div className="px-5.5 md:px-16 lg:px-24 xl:px-32 2xl:px-48">
            {children}
         </div>
         <Footer />
      </>
   )
}
