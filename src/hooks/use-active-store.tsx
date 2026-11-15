import { create } from 'zustand'

interface UseActiveStoreInterface {
   id?: string
   set: (id: string) => void
   reset: () => void
}

export const useActiveStore = create<UseActiveStoreInterface>((set) => ({
   id: undefined,
   set: (id: string) => {
      set({ id })
   },
   reset: () => {
      set({ id: undefined })
   },
}))
