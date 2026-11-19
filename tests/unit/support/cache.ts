import { vi } from 'vitest'

/**
 * `next/cache` doubles. `unstable_cache` runs the callback once and remembers
 * the result so the cached catalogue helpers stay assertable.
 */
export const revalidateTag = vi.fn()
export const revalidatePath = vi.fn()
export const updateTag = vi.fn()
export const refreshTag = vi.fn()

const memory = new Map<string, unknown>()

export function unstable_cache<T extends (...args: never[]) => unknown>(
   fn: T,
   keys: string[] = [],
   _options: unknown = {}
) {
   return (async (...args: Parameters<T>) => {
      const cacheKey = `${keys.join(':')}:${JSON.stringify(args)}`

      if (!memory.has(cacheKey)) memory.set(cacheKey, await fn(...args))

      return memory.get(cacheKey)
   }) as T
}

export const cacheLife = vi.fn()
export const cacheTag = vi.fn()

export function resetCacheMock() {
   memory.clear()
   revalidateTag.mockClear()
   revalidatePath.mockClear()
}
