import { vi } from 'vitest'

/** Fetch double with a fluent builder so each call site stays short. */
export interface MockResponseInit {
   status?: number
   json?: unknown
   text?: string
   headers?: Record<string, string>
   reject?: Error | string
}

export function mockResponse({
   status = 200,
   json,
   text,
   headers = {},
   reject,
}: MockResponseInit = {}) {
   if (reject) return Promise.reject(reject)

   const body = text ?? (json === undefined ? '' : JSON.stringify(json))

   return Promise.resolve(
      new Response(body, {
         status,
         headers: { 'content-type': 'application/json', ...headers },
      })
   )
}

/** `withFetch([{json}, {reject}])` — one entry per call, in order. */
export function withFetch(queue: MockResponseInit[]) {
   const fetchMock = vi.fn(async (_input: unknown, _init?: unknown) => {
      const next = queue.shift()

      if (!next) throw new Error('unexpected fetch call')

      return await mockResponse(next)
   })

   vi.stubGlobal('fetch', fetchMock)

   return fetchMock
}

export function jsonRequest(
   url: string,
   {
      method = 'GET',
      body,
      headers = {},
   }: {
      method?: string
      body?: unknown
      headers?: Record<string, string>
   } = {}
) {
   return new Request(url, {
      method,
      headers: {
         ...(body === undefined ? {} : { 'content-type': 'application/json' }),
         ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
   })
}

/** A `Request` whose `json()` throws, for malformed-body branches. */
export function brokenJsonRequest(url: string) {
   const request = new Request(url, { method: 'POST', body: '{not json' })

   return request
}

export async function readJson(response: Response) {
   return (await response.json()) as Record<string, unknown>
}

export function header(response: Response, name: string) {
   return response.headers.get(name)
}
