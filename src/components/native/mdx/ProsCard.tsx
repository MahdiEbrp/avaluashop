import { CheckSquareIcon } from 'lucide-react'

export default function ProsCard({ title, pros }) {
   return (
      <div className="my-4 w-full rounded-xl border border-success/30 bg-success/10 p-6">
         <span>{`You might use ${String(title)} if...`}</span>
         <div className="mt-4">
            {pros.map((pro) => (
               <div
                  key={pro}
                  className="mb-2 flex gap-2 items-baseline font-normal"
               >
                  <CheckSquareIcon className="h-4" />
                  <span>{pro}</span>
               </div>
            ))}
         </div>
      </div>
   )
}
