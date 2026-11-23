import { NextRequest } from 'next/server'

import { signJWT } from '@/lib/jwt'
import { proxy } from '@/proxy'

const tokenFor = (sub: string, role: 'user' | 'admin') => signJWT({ sub, role }, { exp: '5m' })

const request = (path: string, init: { cookie?: string; authorization?: string } = {}) => {
   const headers = new Headers()

   if (init.cookie) headers.set('cookie', init.cookie)
   if (init.authorization) headers.set('authorization', init.authorization)

   return new NextRequest(`http://localhost:3000${path}`, { headers })
}

const redirectTarget = (response: Response) => new URL(response.headers.get('location')).pathname

describe('proxy — public routes', () => {
   it.each([
      '/admin/login',
      '/api/auth/otp/email/try',
      '/api/auth/logout',
      '/api/admin/auth/otp/email/verify',
      '/api/admin/auth/logout',
      '/api/health',
   ])('lets %s through without a token', async (path) => {
      const response = await proxy(request(path))

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
   })

   it('still forwards the request id headers for public routes', async () => {
      const response = await proxy(request('/api/health'))

      expect(response.headers.get('x-middleware-next')).toBe('1')
   })
})

describe('proxy — anonymous visitors', () => {
   it('sends a storefront page to /login', async () => {
      const response = await proxy(request('/profile/orders'))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/login')
   })

   it('sends an admin page to /admin/login', async () => {
      const response = await proxy(request('/admin/products'))

      expect(redirectTarget(response)).toBe('/admin/login')
   })

   it('answers the storefront API with a 401 JSON body', async () => {
      const response = await proxy(request('/api/cart'))
      const body = (await response.json()) as { message: string; status: string }

      expect(response.status).toBe(401)
      expect(response.headers.get('content-type')).toBe('application/json')
      expect(body).toEqual({ status: 'fail', message: 'INVALID TOKEN', errors: null })
   })

   it('answers the admin API with a 401 JSON body', async () => {
      const response = await proxy(request('/api/admin/products'))

      expect(response.status).toBe(401)
   })
})

describe('proxy — storefront session', () => {
   it('forwards the user id to the route handler', async () => {
      const token = await tokenFor('user-1', 'user')
      const response = await proxy(request('/api/cart', { cookie: `token=${token}` }))

      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-next')).toBe('1')
      expect(response.headers.get('x-middleware-request-x-user-id')).toBe('user-1')
   })

   it('accepts a bearer token as well as a cookie', async () => {
      const token = await tokenFor('user-2', 'user')
      const response = await proxy(request('/profile/edit', { authorization: `Bearer ${token}` }))

      expect(response.headers.get('x-middleware-request-x-user-id')).toBe('user-2')
   })

   it('refuses the admin panel for a storefront session', async () => {
      const token = await tokenFor('user-1', 'user')
      const response = await proxy(request('/admin/users', { cookie: `token=${token}` }))

      expect(redirectTarget(response)).toBe('/admin/login')
   })

   it('refuses the admin API for a storefront session with a JSON 401', async () => {
      const token = await tokenFor('user-1', 'user')
      const response = await proxy(request('/api/admin/users', { cookie: `token=${token}` }))
      const body = (await response.json()) as { message: string }

      expect(response.status).toBe(401)
      expect(body.message).toBe('ADMIN ROLE REQUIRED')
   })

   it('does not clear a valid storefront token it merely refused for admin', async () => {
      const token = await tokenFor('user-1', 'user')
      const response = await proxy(request('/admin', { cookie: `token=${token}` }))

      expect(response.headers.get('set-cookie') ?? '').not.toContain('token=;')
   })
})

describe('proxy — admin session', () => {
   it('lets an admin into the dashboard', async () => {
      const token = await tokenFor('owner-1', 'admin')
      const response = await proxy(request('/admin/products', { cookie: `token=${token}` }))

      expect(response.headers.get('x-middleware-request-x-user-id')).toBe('owner-1')
   })

   it('lets an admin call the admin API', async () => {
      const token = await tokenFor('owner-1', 'admin')
      const response = await proxy(request('/api/admin/products', { cookie: `token=${token}` }))

      expect(response.headers.get('x-middleware-next')).toBe('1')
   })
})

describe('proxy — broken sessions', () => {
   it('clears the cookies and redirects a page when the token does not verify', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      const response = await proxy(request('/profile/edit', { cookie: 'token=garbage' }))

      expect(redirectTarget(response)).toBe('/login')
      const setCookie = response.headers.getSetCookie().join(';')
      expect(setCookie).toContain('token=')
      expect(setCookie).toContain('logged-in=')
   })

   it('clears cookies and redirects to the admin login for admin pages', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      const response = await proxy(request('/admin/orders', { cookie: 'token=garbage' }))

      expect(redirectTarget(response)).toBe('/admin/login')
   })

   it('answers the API with a JSON 401 for a broken token', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      const response = await proxy(request('/api/orders', { cookie: 'token=garbage' }))
      const body = (await response.json()) as { message: string }

      expect(response.status).toBe(401)
      expect(body.message).toBe('UNAUTHORIZED')
   })

   it('rejects a token that verifies but carries no subject', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      const { SignJWT } = await import('jose')
      const anonymous = await new SignJWT({ role: 'user' })
         .setProtectedHeader({ alg: 'HS256' })
         .sign(new TextEncoder().encode(process.env.JWT_SECRET_KEY))

      const response = await proxy(request('/api/cart', { cookie: `token=${anonymous}` }))

      expect(response.status).toBe(401)
   })
})

describe('proxy — matcher', () => {
   it('covers the three protected trees', async () => {
      const { config } = await import('@/proxy')

      expect(config.matcher).toEqual(['/profile/:path*', '/admin/:path*', '/api/:path*'])
   })
})
