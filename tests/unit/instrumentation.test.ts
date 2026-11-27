import { register } from '@/instrumentation'

afterEach(() => {
   vi.unstubAllEnvs()
})

describe('register', () => {
   it('does nothing outside the Node.js runtime', async () => {
      vi.stubEnv('NEXT_RUNTIME', 'edge')
      vi.stubEnv('JWT_SECRET_KEY', '')

      await expect(register()).resolves.toBeUndefined()
   })

   it('passes when the JWT secret is valid', async () => {
      vi.stubEnv('NEXT_RUNTIME', 'nodejs')

      await expect(register()).resolves.toBeUndefined()
   })

   it('fails the boot when the JWT secret is missing', async () => {
      vi.stubEnv('NEXT_RUNTIME', 'nodejs')
      vi.stubEnv('JWT_SECRET_KEY', '')

      await expect(register()).rejects.toThrow(/JWT_SECRET_KEY/)
   })
})
