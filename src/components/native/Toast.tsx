import { DeleteIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Toast({ message }) {
   // Visible from the first render; only the dismissal timer writes state.
   const [toastVisibility, setToastVisibility] = useState(true)

   useEffect(() => {
      const timeout = setTimeout(() => {
         setToastVisibility(false)
      }, 5000)

      return () => {
         clearTimeout(timeout)
      }
   }, [])

   if (toastVisibility)
      return (
         <div
            id="toast-warning"
            className="fixed right-5 bottom-5 z-30 flex w-full max-w-xs items-center rounded-lg bg-card p-4 text-muted-foreground"
            role="alert"
         >
            <div className="text-sm font-normal">{message}</div>
            <button
               type="button"
               className="-mx-1.5 -my-1.5 ml-auto inline-flex h-8 w-8 rounded-lg bg-card p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
               data-dismiss-target="#toast-warning"
               aria-label="Close"
               onClick={() => {
                  setToastVisibility(false)
               }}
            >
               <DeleteIcon className="h-4" />
            </button>
         </div>
      )
}
