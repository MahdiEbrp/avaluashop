import { routerMock } from '../unit/support/navigation'
import { vi } from 'vitest'

const useRouter = vi.fn(() => routerMock)

const nextRouter = { useRouter }

export default nextRouter
export { useRouter }
