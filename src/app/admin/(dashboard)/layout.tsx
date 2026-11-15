import Navbar from '@/components/admin/navbar'

export default function DashboardLayout({
   children,
}: Readonly<{
   children: React.ReactNode
}>) {
   return (
      <>
         <Navbar />
         <div className="px-5.5 md:px-16 lg:px-24 xl:px-32 2xl:px-48">
            {children}
         </div>
      </>
   )
}
