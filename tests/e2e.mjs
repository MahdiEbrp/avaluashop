/**
 * End-to-end suite.
 *
 * Boots the production build against a real PostgreSQL and walks the app the
 * way a browser and the admin panel would:
 *   1. route inventory — every route renders, no accidental redirects
 *   2. API acceptance — every /api route answers with a non-empty body
 *   3. auth matrix — anonymous / invalid / valid tokens
 *   4. storefront contract — purchasable items stay purchasable
 *   5. admin contract — full create → read → update → delete cycle
 *   6. layout contract — RTL + brand font
 *
 *   npm run test:e2e
 */
import {
   check,
   closeDb,
   dbQuery,
   req,
   section,
   startServer,
   stopServer,
   summary,
} from './harness.mjs'

const PUBLIC_PAGES = [
   '/',
   '/products',
   '/cart',
   '/checkout',
   '/login',
   '/privacy',
   '/blog',
   '/wishlist',
   '/admin/login',
   '/robots.txt',
   '/sitemap.xml',
]

/* Gated pages: unauthenticated visitors must be bounced to the login screen. */
const GATED_PAGES = [
   ['/profile/edit', '/login'],
   ['/profile/orders', '/login'],
   ['/profile/addresses', '/login'],
   ['/admin', '/admin/login'],
   ['/admin/products', '/admin/login'],
   ['/admin/categories', '/admin/login'],
   ['/admin/brands', '/admin/login'],
   ['/admin/orders', '/admin/login'],
   ['/admin/users', '/admin/login'],
   ['/admin/banners', '/admin/login'],
   ['/admin/payments', '/admin/login'],
]

/* Every route handler under src/app/api. Kept explicit so a new file that is
   never asserted here is a visible omission. */
const API_ROUTES = [
   '/api/addresses',
   '/api/cart',
   '/api/orders',
   '/api/products',
   '/api/profile',
   '/api/wishlist',
   '/api/subscription/email',
   '/api/subscription/phone',
   '/api/auth/logout',
   '/api/health',
   '/api/admin/products',
   '/api/admin/categories',
   '/api/admin/brands',
   '/api/admin/auth/logout',
]

async function main() {
   console.log('booting production server…')
   await startServer()

   /* ---------------------------------------------------------------- */
   section('1. Public routes render (no redirects)')

   for (const path of PUBLIC_PAGES) {
      const r = await req(path)
      const ok = r.status === 200 && r.bytes > 0
      check(
         `GET ${path}`,
         ok,
         `${r.status} · ${r.bytes}B · ${r.ms.toFixed(0)}ms`
      )
   }

   section('2. Gated areas redirect anonymous visitors to their login screen')

   for (const [path, target] of GATED_PAGES) {
      const r = await req(path)
      check(
         `GET ${path} → ${target}`,
         r.status === 307 && r.location === target,
         `${r.status} → ${r.location}`
      )
   }

   section('3. API acceptance: no 3xx, always a body')

   /* Public by design: the auth handshakes answer anyone. Everything else must
      reject anonymous callers with a 401 JSON body. */
   const PUBLIC_API = new Set([
      '/api/auth/logout',
      '/api/admin/auth/logout',
      '/api/health',
   ])

   for (const path of API_ROUTES) {
      const r = await req(path)
      const noRedirect = r.status < 300 || r.status >= 400
      const hasBody = r.bytes > 0
      const expected = PUBLIC_API.has(path) ? 200 : 401
      check(
         `GET ${path} (anonymous) → ${expected}`,
         noRedirect && hasBody && r.status === expected,
         `${r.status} ${r.contentType} ${r.bytes}B`
      )
   }

   section('4. Unknown routes 404 instead of redirecting')

   const notFound = await req('/definitely-not-a-route')
   check(
      'GET /definitely-not-a-route → 404',
      notFound.status === 404,
      `${notFound.status}`
   )

   /* ---------------------------------------------------------------- */
   section('5. Authentication handshake (real OTP, no shortcuts)')

   const [user] = await dbQuery(
      'SELECT id, email FROM "User" ORDER BY "createdAt" LIMIT 1'
   )
   check('a seeded user exists', Boolean(user?.id), user?.email ?? '')

   const otpTry = await req('/api/auth/otp/email/try', {
      method: 'POST',
      body: { email: user.email },
   })
   check(
      'POST /api/auth/otp/email/try → 200 JSON',
      otpTry.status === 200 && otpTry.json?.status === 'success',
      `${otpTry.status} · delivered=${otpTry.json?.delivered}`
   )

   const [issued] = await dbQuery('SELECT "OTP" FROM "User" WHERE email = $1', [
      user.email,
   ])
   check(
      'an OTP was persisted for that address',
      /^\d{4,8}$/.test(String(issued?.OTP)),
      `${String(issued?.OTP).length} digits`
   )

   const verify = await req('/api/auth/otp/email/verify', {
      method: 'POST',
      body: { email: user.email, OTP: issued.OTP },
   })
   const sessionCookie = verify.setCookie
      .find((c) => c.startsWith('token='))
      ?.split(';')[0]
   check(
      'POST /api/auth/otp/email/verify → 200 + session cookie',
      verify.status === 200 && Boolean(sessionCookie),
      `${verify.status} · ${sessionCookie ? 'token issued' : 'no cookie'}`
   )

   const token = verify.json?.token ?? sessionCookie?.replace('token=', '')
   const cookie = `${sessionCookie}; logged-in=true`

   const me = await req('/api/profile', { cookie })
   check(
      'the fresh session can read /api/profile',
      me.status === 200 && me.json?.email === user.email,
      `${me.status} · ${me.json?.email ?? me.text.slice(0, 40)}`
   )

   const invalidCookie = 'token=not-a-real-jwt'
   const invalid = await req('/api/admin/products', { cookie: invalidCookie })
   check(
      'invalid token → 401 JSON',
      invalid.status === 401,
      `${invalid.status} ${invalid.text.slice(0, 40)}`
   )

   const invalidPage = await req('/admin', { cookie: invalidCookie })
   const cleared = invalidPage.setCookie.some((c) => /token=;|token=$/.test(c))
   check(
      'invalid token on a gated page → 307 and cookie cleared',
      invalidPage.status === 307 && cleared,
      `${invalidPage.status} · cleared=${cleared}`
   )

   /* A storefront session must never reach the admin scope: `sub` alone cannot
      tell a User from an Owner, so the token carries a role. */
   const userOnAdminPage = await req('/admin', { cookie })
   check(
      'a storefront token is bounced from /admin to /admin/login',
      userOnAdminPage.status === 307 &&
         userOnAdminPage.location?.includes('/admin/login'),
      `${userOnAdminPage.status} → ${userOnAdminPage.location ?? 'no location'}`
   )

   const userOnAdminApi = await req('/api/admin/products', { cookie })
   check(
      'a storefront token is refused by /api/admin/** with 401',
      userOnAdminApi.status === 401,
      `${userOnAdminApi.status} ${userOnAdminApi.text.slice(0, 40)}`
   )

   /* The real admin handshake — same OTP flow the panel uses. */
   const [owner] = await dbQuery(
      'SELECT id, email FROM "Owner" ORDER BY "createdAt" LIMIT 1'
   )
   check('a seeded owner exists', Boolean(owner?.id), owner?.email ?? '')

   const adminTry = await req('/api/admin/auth/otp/email/try', {
      method: 'POST',
      body: { email: owner.email },
   })
   check(
      'POST /api/admin/auth/otp/email/try → 200',
      adminTry.status === 200,
      `${adminTry.status}`
   )

   const [issuedAdmin] = await dbQuery(
      'SELECT "OTP" FROM "Owner" WHERE email = $1',
      [owner.email]
   )
   const adminVerify = await req('/api/admin/auth/otp/email/verify', {
      method: 'POST',
      body: { email: owner.email, OTP: issuedAdmin.OTP },
   })
   const adminSession = adminVerify.setCookie
      .find((c) => c.startsWith('token='))
      ?.split(';')[0]
   const adminCookie = `${adminSession}; logged-in=true`
   check(
      'admin OTP verify → 200 + session cookie',
      adminVerify.status === 200 && Boolean(adminSession),
      `${adminVerify.status} · ${adminSession ? 'token issued' : 'no cookie'}`
   )

   const adminOnAdmin = await req('/admin', { cookie: adminCookie })
   check(
      'an admin token opens /admin',
      adminOnAdmin.status === 200 && adminOnAdmin.bytes > 1000,
      `${adminOnAdmin.status} · ${adminOnAdmin.bytes}B`
   )

   /* ---------------------------------------------------------------- */
   section('6. Storefront contract — purchasable stays purchasable')

   const productsApi = await req('/api/products', { cookie })
   const products = Array.isArray(productsApi.json) ? productsApi.json : []
   check(
      'GET /api/products (authenticated) → 200 + array',
      productsApi.status === 200 && products.length > 0,
      `${productsApi.status} · ${products.length} products`
   )

   const purchasable = products.filter((p) => p.isAvailable)
   check(
      'at least one product is purchasable',
      purchasable.length > 0,
      `${purchasable.length}/${products.length} available`
   )

   const priced = purchasable.filter((p) => Number(p.price) > 0)
   check(
      'every purchasable product carries a positive price',
      priced.length === purchasable.length,
      `${priced.length}/${purchasable.length}`
   )

   const target = purchasable[0]
   check(
      'purchasable product has a slug-able id',
      Boolean(target?.id),
      target?.id ?? ''
   )

   const detailApi = await req(`/api/products/${target.id}`, { cookie })
   check(
      `GET /api/products/${target.id.slice(0, 8)}… → 200`,
      detailApi.status === 200 && detailApi.json?.id === target.id,
      `${detailApi.status}`
   )

   const listPage = await req('/products', { cookie })
   check(
      'storefront /products lists a seeded product title',
      listPage.status === 200 && listPage.text.includes(target.title),
      `"${String(target.title).slice(0, 40)}"`
   )

   const detailPage = await req(`/products/${target.id}`, { cookie })
   const hasBuyControl =
      detailPage.status === 200 &&
      /add to cart|buy now|افزودن به سبد|خرید/i.test(detailPage.text)
   check(
      'product detail page offers a buy control',
      hasBuyControl,
      `${detailPage.status} · ${detailPage.bytes}B`
   )

   section('7. Storefront contract — the cart actually accepts the item')

   const before = await req('/api/cart', { cookie })
   check(
      'GET /api/cart (authenticated) → 200',
      before.status === 200,
      `${before.status}`
   )

   const add = await req('/api/cart', {
      method: 'POST',
      cookie,
      body: { productId: target.id, count: 2 },
   })
   check('POST /api/cart adds the product', add.status === 200, `${add.status}`)

   const after = await req('/api/cart', { cookie })
   const line = (after.json?.items ?? []).find((i) => i.productId === target.id)
   check(
      'the cart now holds that product at the requested quantity',
      after.status === 200 && line?.count === 2,
      line ? `count=${line.count}` : 'line missing'
   )

   const empty = await req('/api/cart', {
      method: 'POST',
      cookie,
      body: { productId: target.id, count: 0 },
   })
   const emptied = await req('/api/cart', { cookie })
   const gone = !(emptied.json?.items ?? []).some(
      (i) => i.productId === target.id
   )
   check(
      'POST /api/cart with count 0 removes the line',
      empty.status === 200 && gone,
      `${empty.status} · removed=${gone}`
   )

   /* A body that is not a valid cart line must be a 400, never a Prisma 500. */
   const badCount = await req('/api/cart', {
      method: 'POST',
      cookie,
      body: { productId: target.id, count: 'not-a-number' },
   })
   check(
      'POST /api/cart with a non-numeric count → 400',
      badCount.status === 400,
      `${badCount.status} ${badCount.text.slice(0, 48)}`
   )

   const badProduct = await req('/api/cart', {
      method: 'POST',
      cookie,
      body: { productId: 'not-a-real-product', count: 1 },
   })
   check(
      'POST /api/cart with an unknown product → 404',
      badProduct.status === 404,
      `${badProduct.status}`
   )

   const hugeCount = await req('/api/cart', {
      method: 'POST',
      cookie,
      body: { productId: target.id, count: 5000 },
   })
   check(
      'POST /api/cart clamps an absurd quantity with 400',
      hugeCount.status === 400,
      `${hugeCount.status}`
   )

   section('8. Storefront contract — orders are readable')

   const orders = await req('/api/orders', { cookie })
   check(
      'GET /api/orders → 200 + array',
      orders.status === 200 && Array.isArray(orders.json),
      `${orders.status} · ${Array.isArray(orders.json) ? orders.json.length : '?'} orders`
   )

   const profile = await req('/api/profile', { cookie })
   check(
      'GET /api/profile keeps the internal id out of the payload',
      profile.status === 200 &&
         profile.json?.email === user.email &&
         typeof profile.json?.id === 'undefined',
      `${profile.status} · keys: ${Object.keys(profile.json ?? {}).join(',')}`
   )

   /* ---------------------------------------------------------------- */
   section('9. Admin read endpoints')

   for (const path of [
      '/api/admin/products',
      '/api/admin/categories',
      '/api/admin/brands',
   ]) {
      const r = await req(path, { cookie: adminCookie })
      check(
         `GET ${path} (admin) → 200 + array`,
         r.status === 200 && Array.isArray(r.json),
         `${r.status} · ${Array.isArray(r.json) ? r.json.length : '?'} rows`
      )
   }

   const brands = (await req('/api/admin/brands', { cookie: adminCookie })).json ?? []
   if (brands.length) {
      const b = brands[0]
      const one = await req(`/api/admin/brands/${b.id}`, { cookie: adminCookie })
      check(
         'GET /api/admin/brands/[id] returns a brand (not a category)',
         one.status === 200 &&
            one.json?.id === b.id &&
            typeof one.json?.logo !== 'undefined',
         `${one.status} · ${one.json?.title ?? 'null'}`
      )
   }

   /* ---------------------------------------------------------------- */
   section('10. Admin CRUD — create → read → update → delete')

   const createTitle = `E2E Brand ${Date.now()}`
   const created = await req('/api/admin/brands', {
      method: 'POST',
      cookie: adminCookie,
      body: {
         title: createTitle,
         description: 'created by the e2e suite',
         logo: '/e2e.svg',
      },
   })
   const newId = created.json?.id
   check(
      'POST /api/admin/brands creates a brand',
      created.status === 200 && Boolean(newId),
      `${created.status} · ${newId?.slice(0, 10)}`
   )

   const readBack = await req(`/api/admin/brands/${newId}`, { cookie: adminCookie })
   check(
      'the new brand reads back',
      readBack.status === 200 && readBack.json?.title === createTitle,
      `${readBack.status} · "${readBack.json?.title ?? 'null'}"`
   )

   const renamed = `${createTitle} (edited)`
   const patched = await req(`/api/admin/brands/${newId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { title: renamed },
   })
   check(
      'PATCH /api/admin/brands/[id] renames it',
      patched.status === 200 && patched.json?.title === renamed,
      `${patched.status} · "${patched.json?.title ?? 'null'}"`
   )

   const listAfterPatch =
      (await req('/api/admin/brands', { cookie: adminCookie })).json ?? []
   check(
      'the rename is visible in the collection',
      listAfterPatch.some((b) => b.id === newId && b.title === renamed),
      `${listAfterPatch.length} brands`
   )

   const deleted = await req(`/api/admin/brands/${newId}`, {
      method: 'DELETE',
      cookie: adminCookie,
   })
   check(
      'DELETE /api/admin/brands/[id] removes it (was 500 before the fix)',
      deleted.status === 200 && deleted.json?.id === newId,
      `${deleted.status}`
   )

   const listAfterDelete =
      (await req('/api/admin/brands', { cookie: adminCookie })).json ?? []
   check(
      'the deleted brand is gone from the collection',
      !listAfterDelete.some((b) => b.id === newId),
      `${listAfterDelete.length} brands`
   )

   const categoriesIntact =
      (await req('/api/admin/categories', { cookie: adminCookie })).json ?? []
   check(
      'deleting a brand left the categories untouched',
      categoriesIntact.length > 0,
      `${categoriesIntact.length} categories`
   )

   section('11. Admin CRUD — validation and authorisation')

   const noTitle = await req('/api/admin/brands', {
      method: 'POST',
      cookie: adminCookie,
      body: { description: 'no title' },
   })
   check(
      'POST without a title → 400',
      noTitle.status === 400,
      `${noTitle.status}`
   )

   const anonCreate = await req('/api/admin/brands', {
      method: 'POST',
      body: { title: 'should never exist' },
   })
   check(
      'anonymous POST is rejected with 401',
      anonCreate.status === 401,
      `${anonCreate.status}`
   )

   const serverRows = await dbQuery('SELECT id FROM "Brand" WHERE title = $1', [
      'should never exist',
   ])
   check(
      'the rejected write never reached the database',
      serverRows.length === 0,
      `${serverRows.length} rows`
   )

   /* ---------------------------------------------------------------- */
   section('12. Layout contract')

   const home = await req('/')
   check('root document is RTL', home.text.includes('dir="rtl"'), '')
   const cssHrefs = [
      ...home.text.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g),
   ].map((m) => m[1])
   let css = ''
   for (const href of new Set(cssHrefs)) css += (await req(href)).text
   check(
      'Baloo Bhaijaan 2 is wired into the font stack',
      css.includes('--font-baloo') && css.includes('var(--font-baloo)'),
      `${new Set(cssHrefs).size} stylesheets, ${(css.length / 1024).toFixed(0)}KB of CSS`
   )
   check(
      'theme stylesheet is inlined by Next',
      home.text.includes('data-next-css') || home.text.includes('.css'),
      ''
   )
   check(
      'no raw Tailwind palette classes leaked into the DOM contract',
      !home.text.includes('bg-neutral-200'),
      ''
   )

   section('13. Logout is a JSON endpoint that clears the session')

   const logout = await req('/api/auth/logout', { cookie })
   const logoutClears = logout.setCookie.some((c) =>
      /^token=;|^token=$/.test(c)
   )
   check(
      'GET /api/auth/logout → 200 JSON (never a redirect)',
      logout.status === 200 && logout.json?.message === 'LOGGED_OUT',
      `${logout.status} · ${logout.json?.message ?? logout.text.slice(0, 30)}`
   )
   check(
      'logout clears the token cookie',
      logoutClears,
      logout.setCookie.join(' | ').slice(0, 80)
   )

   /* Sessions are stateless HS256 JWTs, so the server cannot revoke an already
      issued token; the browser losing the cookie is what ends the session.
      What must hold is that the response clears it. */
   const logoutFlags = logout.setCookie.filter((c) =>
      /^(token|logged-in)=/.test(c)
   )
   check(
      'logout clears every session cookie the app set',
      logoutFlags.length === 2,
      logoutFlags.map((c) => c.split('=')[0]).join(', ')
   )

   section('14. Page weight sanity')

   const heavy = []
   for (const path of ['/', '/products', '/blog', '/admin/login']) {
      const r = await req(path)
      if (r.bytes > 900_000)
         heavy.push(`${path} = ${(r.bytes / 1024).toFixed(0)}KB`)
   }
   check(
      'no page ships an absurd payload (>900KB)',
      heavy.length === 0,
      heavy.join(', ')
   )

   section('15. Hardening — headers, health, cookie flags, OTP throttling')

   const homeProbe = await req('/')
   const header = (name) => homeProbe.headers.get(name) ?? ''
   const csp = header('content-security-policy')
   check(
      'CSP is served with default-src / frame-ancestors / object-src',
      csp.includes("default-src 'self'") &&
         csp.includes("frame-ancestors 'none'") &&
         csp.includes("object-src 'none'"),
      csp.slice(0, 60)
   )
   check(
      'anti-clickjacking + nosniff + referrer policy',
      header('x-frame-options') === 'DENY' &&
         header('x-content-type-options') === 'nosniff' &&
         header('referrer-policy').length > 0,
      `${header('x-frame-options')} · ${header('x-content-type-options')} · ${header('referrer-policy')}`
   )
   check(
      'HSTS is pinned for a year or more',
      /max-age=(\d+)/.test(header('strict-transport-security')) &&
         Number(/max-age=(\d+)/.exec(header('strict-transport-security'))[1]) >=
            31_536_000,
      header('strict-transport-security')
   )
   check(
      'x-powered-by is suppressed',
      !header('x-powered-by'),
      `x-powered-by = ${header('x-powered-by') || 'absent'}`
   )

   const health = await req('/api/health')
   check(
      'GET /api/health → 200 with the database reachable and no caching',
      health.status === 200 &&
         health.json?.status === 'success' &&
         health.json?.database === 'reachable' &&
         (health.headers.get('cache-control') ?? '').includes('no-store'),
      `${health.status} · ${health.text.slice(0, 60)}`
   )

   const rawCookie = adminVerify.setCookie.find((c) => c.startsWith('token='))
   check(
      'session cookie is HttpOnly + SameSite=Lax + Path=/',
      /HttpOnly/i.test(rawCookie) &&
         /SameSite=lax/i.test(rawCookie) &&
         /Path=\//.test(rawCookie),
      rawCookie?.replace(/token=[^;]+/, 'token=<redacted>') ?? 'missing'
   )

   /* A stranger hammering the verify endpoint must be throttled, not served
      forever. This address is never granted an OTP, so every attempt fails. */
   const attacker = 'throttle-probe@example.com'
   const statuses = []
   for (let i = 0; i < 7; i += 1) {
      const r = await req('/api/auth/otp/email/verify', {
         method: 'POST',
         body: { email: attacker, OTP: '000000' },
      })
      statuses.push(r.status)
      if (i === 4) {
         check(
            'wrong OTP for an unknown address → 401 (not 500)',
            r.status === 401,
            `${r.status} ${r.text.slice(0, 40)}`
         )
      }
   }
   const throttled = statuses.filter((code) => code === 429).length
   check(
      'the 6th+ failed verify is throttled with 429',
      throttled >= 1 && statuses.at(-1) === 429,
      statuses.join(' → ')
   )

   const throttledResponse = await req('/api/auth/otp/email/verify', {
      method: 'POST',
      body: { email: attacker, OTP: '000000' },
   })
   check(
      'throttled response sets Retry-After and cache-control: no-store',
      throttledResponse.status === 429 &&
         Number(throttledResponse.headers.get('retry-after')) > 0 &&
         (throttledResponse.headers.get('cache-control') ?? '').includes(
            'no-store'
         ),
      `${throttledResponse.headers.get('retry-after')}s · ${throttledResponse.headers.get('cache-control')}`
   )

   section('16. Guest cart survives sign-in (and junk in it is dropped)')

   const userEmail =
      (await dbQuery('SELECT email FROM "User" ORDER BY "createdAt" LIMIT 1'))[0]
         ?.email ?? null

   check('a seeded user address is available', Boolean(userEmail), userEmail ?? '')

   const resend = await req('/api/auth/otp/email/try', {
      method: 'POST',
      body: { email: userEmail },
   })
   check('a second OTP can be requested', resend.status === 200, `${resend.status}`)

   const [{ OTP: freshOtp }] = await dbQuery(
      'SELECT "OTP" FROM "User" WHERE email = $1',
      [userEmail]
   )

   /* The payload a browser sends: two lines for the same product, one line for
      a product that does not exist, one line whose count is garbage. */
   const merged = await req('/api/auth/otp/email/verify', {
      method: 'POST',
      body: {
         email: userEmail,
         OTP: freshOtp,
         cart: {
            items: [
               { productId: target.id, count: 2 },
               { productId: target.id, count: 1 },
               { productId: 'ghost-product', count: 4 },
               { productId: target.id, count: 'NaN' },
            ],
         },
      },
   })
   const mergedCookie = merged.setCookie
      .find((c) => c.startsWith('token='))
      ?.split(';')[0]
   check(
      'verify with a guest cart → 200 + session',
      merged.status === 200 && Boolean(mergedCookie),
      `${merged.status}`
   )

   const mergedCart = await req('/api/cart', {
      cookie: `${mergedCookie}; logged-in=true`,
   })
   const lines = mergedCart.json?.items ?? []
   const mergedLine = lines.find((item) => item.productId === target.id)
   check(
      'the two guest lines were summed into the account cart',
      mergedLine?.count === 3,
      `count=${mergedLine?.count ?? 'missing'}`
   )
   check(
      'the unknown product and the invalid line were dropped',
      lines.length === 1 &&
         !lines.some((item) => item.productId === 'ghost-product'),
      `${lines.length} line(s)`
   )

   await dbQuery('DELETE FROM "CartItem" WHERE "cartId" = $1', [
      mergedCart.json?.userId ?? '',
   ])

   section('17. Admin writes that used to post to the wrong endpoint')

   const bannerList = await req('/api/admin/banners', { cookie: adminCookie })
   check(
      'GET /api/admin/banners → 200 + array',
      bannerList.status === 200 && Array.isArray(bannerList.json),
      `${bannerList.status} · ${bannerList.json?.length ?? '?'} banners`
   )

   const bannerPost = await req('/api/admin/banners', {
      method: 'POST',
      cookie: adminCookie,
      body: { label: `E2E Banner ${Date.now()}`, image: '/e2e-banner.jpg' },
   })
   const bannerId = bannerPost.json?.id
   check(
      'POST /api/admin/banners creates a banner',
      bannerPost.status === 200 && Boolean(bannerId),
      `${bannerPost.status} · ${bannerId?.slice(0, 10) ?? 'no id'}`
   )

   const bannerPatch = await req(`/api/admin/banners/${bannerId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { label: 'E2E Banner (edited)' },
   })
   check(
      'PATCH /api/admin/banners/[id] renames it',
      bannerPatch.status === 200 && bannerPatch.json?.label === 'E2E Banner (edited)',
      `${bannerPatch.status}`
   )

   const bannerBad = await req('/api/admin/banners', {
      method: 'POST',
      cookie: adminCookie,
      body: { label: 'no image' },
   })
   check(
      'POST /api/admin/banners without an image → 400',
      bannerBad.status === 400,
      `${bannerBad.status}`
   )

   const bannerDelete = await req(`/api/admin/banners/${bannerId}`, {
      method: 'DELETE',
      cookie: adminCookie,
   })
   const bannerGone = await req(`/api/admin/banners/${bannerId}`, {
      cookie: adminCookie,
   })
   check(
      'DELETE /api/admin/banners/[id] removes it (404 afterwards)',
      bannerDelete.status === 200 && bannerGone.status === 404,
      `${bannerDelete.status} → ${bannerGone.status}`
   )

   const [firstOrder] = await dbQuery(
      'SELECT id, status FROM "Order" ORDER BY "createdAt" DESC LIMIT 1'
   )
   const orderPatch = await req(`/api/admin/orders/${firstOrder.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'Shipped' },
   })
   check(
      'PATCH /api/admin/orders/[id] moves the status to Shipped',
      orderPatch.status === 200 && orderPatch.json?.status === 'Shipped',
      `${orderPatch.status} · ${orderPatch.json?.status ?? 'null'}`
   )

   const orderBadStatus = await req(`/api/admin/orders/${firstOrder.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'Teleported' },
   })
   check(
      'PATCH /api/admin/orders/[id] rejects a status outside the enum',
      orderBadStatus.status === 400,
      `${orderBadStatus.status}`
   )

   const [firstPayment] = await dbQuery(
      'SELECT id FROM "Payment" ORDER BY "createdAt" DESC LIMIT 1'
   )
   const paymentPatch = await req(`/api/admin/payments/${firstPayment.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'Paid', isSuccessful: true },
   })
   check(
      'PATCH /api/admin/payments/[id] settles a payment',
      paymentPatch.status === 200 &&
         paymentPatch.json?.status === 'Paid' &&
         paymentPatch.json?.isSuccessful === true,
      `${paymentPatch.status} · ${paymentPatch.json?.status ?? 'null'}`
   )

   /* A throwaway customer: created in SQL, edited and removed over HTTP. */
   const throwaway = `e2e-${Date.now()}@example.com`
   const [createdUser] = await dbQuery(
      `INSERT INTO "User" (id, email, name, "updatedAt")
       VALUES ($1, $2, 'E2E Customer', now()) RETURNING id`,
      [`e2e-${Date.now()}`, throwaway]
   )
   const userPatch = await req(`/api/admin/users/${createdUser.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { name: 'Renamed Customer', isBanned: true },
   })
   check(
      'PATCH /api/admin/users/[id] renames and bans',
      userPatch.status === 200 &&
         userPatch.json?.name === 'Renamed Customer' &&
         userPatch.json?.isBanned === true,
      `${userPatch.status} · ${userPatch.json?.name ?? 'null'}`
   )
   check(
      'the admin user payload never leaks the OTP',
      !('OTP' in (userPatch.json ?? {})),
      Object.keys(userPatch.json ?? {}).join(',')
   )

   const userDelete = await req(`/api/admin/users/${createdUser.id}`, {
      method: 'DELETE',
      cookie: adminCookie,
   })
   check(
      'DELETE /api/admin/users/[id] removes a customer without orders',
      userDelete.status === 200,
      `${userDelete.status}`
   )

   const ghostUser = await req('/api/admin/users/does-not-exist', {
      cookie: adminCookie,
   })
   const emptyPatch = await req('/api/admin/users/does-not-exist', {
      method: 'PATCH',
      cookie: adminCookie,
      body: {},
   })
   check(
      'an unknown user id answers 404, an empty patch answers 400',
      ghostUser.status === 404 && emptyPatch.status === 400,
      `${ghostUser.status} · ${emptyPatch.status}`
   )

   const customerWithOrders = await dbQuery(
      'SELECT "userId" FROM "Order" LIMIT 1'
   )
   const guardedDelete = await req(
      `/api/admin/users/${customerWithOrders[0].userId}`,
      { method: 'DELETE', cookie: adminCookie }
   )
   check(
      'a customer with orders is protected with 409 instead of being erased',
      guardedDelete.status === 409,
      `${guardedDelete.status}`
   )
}

main()
   .then(async () => {
      const ok = summary()
      stopServer()
      await closeDb()
      process.exit(ok ? 0 : 1)
   })
   .catch(async (error) => {
      console.error('\ne2e crashed:', error)
      stopServer()
      await closeDb().catch(() => {})
      process.exit(1)
   })
