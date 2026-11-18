import { prismaMock } from '../support/db'

export const USER = { 'X-USER-ID': 'user-1' }

export const json = (body: unknown, headers: Record<string, string> = {}) =>
   new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
   })

export const get = (headers: Record<string, string> = {}, url = 'http://localhost/api/test') =>
   new Request(url, { headers })

/* Route handlers declare their params shape (`Promise<{ bannerId: string }>`),
   so the helper is generic and infers from the call site. */
export const call = <T extends Record<string, string>>(params: T) => ({
   params: Promise.resolve(params),
})

export const bodyOf = async (response: Response) => (await response.json()) as never

export { prismaMock }

/** Silence the route handlers' error logging; failures are asserted on status. */
export function silenceConsole() {
   vi.spyOn(console, 'error').mockImplementation(() => {})
}
