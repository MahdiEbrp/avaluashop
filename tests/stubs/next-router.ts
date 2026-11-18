import { routerMock } from '../unit/support/navigation'
import { vi } from 'vitest'

const useRouter = vi.fn(() => routerMock)

export default { useRouter }
export { useRouter }
