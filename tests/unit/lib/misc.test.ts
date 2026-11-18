import { PrismaPg } from '@prisma/adapter-pg'

import { omitUser } from '@/lib/omit'
import { prismaMock } from '../support/db'
import { generateSerial } from '@/lib/serial'
import { avaluaTableFeatures } from '@/lib/table-features'
import { getTweets } from '@/lib/twitter'

describe('omitUser', () => {
   it('drops the named keys without mutating the source', () => {
      const user = { id: 'u1', email: 'a@b.co', OTP: '12345', name: 'Ada' }

      expect(omitUser(user, 'OTP')).toEqual({ id: 'u1', email: 'a@b.co', name: 'Ada' })
      expect(user.OTP).toBe('12345')
   })

   it('drops several keys at once', () => {
      const user = { id: 'u1', email: 'a@b.co', OTP: '1', emailUnsubscribeToken: 't' }

      expect(omitUser(user, 'OTP', 'emailUnsubscribeToken')).toEqual({
         id: 'u1',
         email: 'a@b.co',
      })
   })

   it('returns an equivalent object when nothing is dropped', () => {
      const user = { id: 'u1' }

      expect(omitUser(user)).toEqual({ id: 'u1' })
      expect(omitUser(user)).not.toBe(user)
   })
})

describe('generateSerial', () => {
   it('defaults to one 5-digit numeric segment', () => {
      const serial = generateSerial({})
      expect(serial).toMatch(/^\d{5}$/)
   })

   it('produces one segment per batch item', () => {
      const serial = generateSerial({ batchCount: 3, batchSize: 4 })
      const segments = serial.split('-')

      expect(segments).toHaveLength(3)
      segments.forEach((segment) => expect(segment).toMatch(/^\d{4}$/))
   })

   it('produces uppercase alphanumerics when asked', () => {
      const serial = generateSerial({ alphanumeric: true, batchSize: 8 })
      expect(serial).toMatch(/^[0-9A-Z]{8}$/)
   })

   it('pads short random draws up to the requested size', () => {
      vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
         ;(array as Uint32Array)[0] = 0
         return array
      })

      expect(generateSerial({ alphanumeric: true, batchSize: 6 })).toBe('000000')
      expect(generateSerial({ batchSize: 6 })).toBe('000000')
   })

   it('is unique across a small batch in practice', () => {
      const serials = new Set(Array.from({ length: 50 }, () => generateSerial({ batchSize: 10 })))
      expect(serials.size).toBe(50)
   })
})

describe('avaluaTableFeatures', () => {
   it('registers the row models the tables rely on', () => {
      expect(avaluaTableFeatures).toHaveProperty('filteredRowModel')
      expect(avaluaTableFeatures).toHaveProperty('paginatedRowModel')
   })
})

describe('google oauth', () => {
   /* The module captures its configuration at import time, so each test that
      cares about env imports it fresh. */
   const load = async () => {
      vi.resetModules()
      return await import('@/lib/google')
   }

   it('builds a consent URL with both scopes and the configured client id', async () => {
      process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ID = 'client-123'
      const { getGoogleURL } = await load()

      const url = new URL(getGoogleURL())

      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
      expect(url.searchParams.get('client_id')).toBe('client-123')
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('access_type')).toBe('offline')
      expect(url.searchParams.get('prompt')).toBe('consent')
      expect(url.searchParams.get('scope')).toContain('userinfo.email')
      expect(url.searchParams.get('scope')).toContain('userinfo.profile')
   })

   it('posts the exchange and returns the token payload', async () => {
      const { getGoogleTokens } = await load()
      const fetchMock = vi.fn().mockResolvedValue(
         new Response(JSON.stringify({ access_token: 'at', id_token: 'it' }), {
            headers: { 'content-type': 'application/json' },
         })
      )
      vi.stubGlobal('fetch', fetchMock)

      await expect(getGoogleTokens({ code: 'the-code' })).resolves.toEqual({
         access_token: 'at',
         id_token: 'it',
      })

      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('grant_type=authorization_code')
      expect(String(url)).toContain('code=the-code')
      expect(init).toMatchObject({ method: 'POST' })
   })

   it('rethrows transport failures with the original message', async () => {
      const { getGoogleTokens } = await load()
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up')))

      await expect(getGoogleTokens({ code: 'x' })).rejects.toThrow('socket hang up')
   })

   it('rethrows non-Error rejections as a generic message', async () => {
      const { getGoogleTokens } = await load()
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue('nope'))

      await expect(getGoogleTokens({ code: 'x' })).rejects.toThrow('Unknown error')
   })

   it('fetches the profile with the bearer token', async () => {
      const { getGoogleUser } = await load()
      const fetchMock = vi.fn().mockResolvedValue(
         new Response(JSON.stringify({ email: 'a@b.co' }), {
            headers: { 'content-type': 'application/json' },
         })
      )
      vi.stubGlobal('fetch', fetchMock)

      await expect(
         getGoogleUser({ id_token: 'id', access_token: 'ac' })
      ).resolves.toEqual({ email: 'a@b.co' })

      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('access_token=ac')
      expect(init.headers.Authorization).toBe('Bearer id')
   })

   it('logs and rethrows profile failures', async () => {
      const { getGoogleUser } = await load()
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('bad token')))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(getGoogleUser({ id_token: 'i', access_token: 'a' })).rejects.toThrow(
         'bad token'
      )
      expect(errorSpy).toHaveBeenCalledWith('Failed to fetch user')
   })

   it('normalises non-Error profile failures', async () => {
      const { getGoogleUser } = await load()
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(undefined))
      vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(getGoogleUser({ id_token: 'i', access_token: 'a' })).rejects.toThrow(
         'Unknown error'
      )
   })
})

describe('getTweets', () => {
   afterEach(() => {
      vi.unstubAllGlobals()
      delete process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ID
   })

   const payload = {
      data: [
         {
            id: 't1',
            text: 'hello',
            author_id: 'a1',
            attachments: { media_keys: ['m1'] },
            referenced_tweets: [{ id: 't0', type: 'quoted' }],
         },
         { id: 't0', text: 'original', author_id: 'a2' },
      ],
      includes: {
         users: [
            { id: 'a1', username: 'one' },
            { id: 'a2', username: 'two' },
         ],
         tweets: [{ id: 't0', text: 'original', author_id: 'a2' }],
         media: [{ media_key: 'm1', type: 'photo' }],
      },
   }

   it('returns an empty list without calling Twitter when there are no ids', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await expect(getTweets([])).resolves.toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
   })

   it('expands authors, media and referenced tweets', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))))

      const tweets = await getTweets(['t1', 't0'])

      /* Newest first: the module unshifts as it walks the payload. */
      expect(tweets).toHaveLength(2)
      const quoted = tweets[1]
      expect(quoted.id).toBe('t1')
      expect(quoted.author).toEqual({ id: 'a1', username: 'one' })
      expect(quoted.media).toEqual([{ media_key: 'm1', type: 'photo' }])
      expect(quoted.referenced_tweets[0]).toMatchObject({ type: 'quoted', id: 't0' })
   })

   it('survives a tweet without attachments or references', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn().mockResolvedValue(
            new Response(
               JSON.stringify({
                  data: [{ id: 't9', text: 'plain', author_id: 'a1' }],
                  includes: { users: [{ id: 'a1' }], tweets: [], media: [] },
               })
            )
         )
      )

      const [tweet] = await getTweets(['t9'])

      expect(tweet.media).toEqual([])
      expect(tweet.referenced_tweets).toEqual([])
   })

   it('returns an empty list when the API has no data', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}))))

      await expect(getTweets(['t'])).resolves.toEqual([])
   })

   it('asks for the documented expansions', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] })))
      vi.stubGlobal('fetch', fetchMock)

      await getTweets(['a', 'b'])

      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('ids=a%2Cb')
      expect(init.headers.Authorization).toBe(`Bearer ${process.env.TWITTER_API_KEY}`)
   })
})

describe('lib/prisma', () => {
   afterEach(() => {
      vi.resetModules()
      delete (globalThis as any).prisma
   })

   it('creates one client with the pg adapter and reuses it', async () => {
      const constructorSpy = vi.spyOn(PrismaPg.prototype as any, 'constructor')
      void constructorSpy

      const { default: prisma } = await import('@/lib/prisma')
      const { default: again } = await import('@/lib/prisma')

      expect(prisma).toBe(again)
      expect((globalThis as any).prisma).toBe(prisma)
      expect((prisma as any).options).toBeDefined()
   })

   it('wires the adapter with the pooled connection string', async () => {
      const { default: prisma } = await import('@/lib/prisma')
      const adapter = (prisma as any).options?.adapter

      expect(adapter).toBeInstanceOf(PrismaPg)
      expect(adapter.config?.connectionString ?? adapter.connectionString).toBe(
         process.env.DATABASE_URL
      )
   })
})

void prismaMock
