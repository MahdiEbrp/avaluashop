# AvaluaShop — فروشگاه اینترنتی آوالواشاپ

<div align="center"><h3>Full-Stack E-Commerce Platform</h3><p>TypeScript · Next.js · Prisma ORM · TailwindCSS</p></div>

AvaluaShop is a complete, RTL/Persian-ready e-commerce platform built as a **single Next.js
application**: the customer-facing storefront at `/` and the admin panel at `/admin`. One codebase,
one build, one deployment.

> Rebranded and modernised from the MIT-licensed
> [`sesto-dev/next-prisma-tailwind-ecommerce`](https://github.com/sesto-dev/next-prisma-tailwind-ecommerce).

## 📦 What's inside

```
.                            ONE package — one package.json, one lockfile, one install
├── src/app/(store)/         storefront  —  /
├── src/app/admin/           admin panel —  /admin   (login at /admin/login)
│   ├── (dashboard)/         products, orders, users, categories,
│   │                        banners, brands, payments
│   └── login/
├── src/app/api/             storefront API   —  /api/*
├── src/app/api/admin/       admin API        —  /api/admin/*
├── src/components/ui/       storefront UI primitives
├── src/components/admin/ui/ admin UI primitives (upstream versions diverged)
├── src/lib/                 prisma, jwt, rate-limit, catalog, cart-merge
├── src/proxy.ts             one auth proxy covering both areas
├── prisma/                  schema + seed (shared by both areas)
├── scripts/dev-db.sh        disposable local PostgreSQL
└── tests/                   e2e + stress suites
```

Storefront and admin share **one Prisma schema**, one `src/lib/prisma.ts`, one set of auth helpers
and one proxy. Previously they were two apps with duplicated schemas and auth code, then a monorepo
with a workspace — now a single package at the repository root: `npm install` once, `npm run dev`
once, no `-w` flags, no per-workspace `node_modules` to reason about.

## 🥂 Features

- **Next.js 16** App Router, React Server Components, Turbopack builds
- **React 19** + TypeScript 5.9 (strict typecheck script included)
- Admin dashboard for products, categories, brands, banners, orders, payments and users
- Authentication via JWT in `httpOnly` cookies, enforced in `proxy.ts`
- File uploads with `next-cloudinary`
- Database-stored blog powered by **MDX**
- Email verification, OTP login and invoices via `@react-email/*`
- Dynamic `sitemap.xml` + `robots.txt`, Next Metadata API for SEO
- UI built on **Radix UI** / shadcn-ui primitives and **TailwindCSS**
- Validation with **Zod**, forms with **react-hook-form**
- **Tabapay** payment gateway integration

## 🛠 Tech stack

Dependencies use caret ranges (`^`) and the lockfile pins the exact versions. TypeScript is deliberately held at the
newest **6.x** rather than 7.0: `typescript-eslint` (used by `eslint-config-next`) hard-throws
_"typescript-eslint does not support TS 7.0"_, which would make `npm run lint` unusable.

|                         | Version                                            |
| ----------------------- | -------------------------------------------------- |
| Next.js                 | `16.4.6`                                           |
| React / React DOM       | `19.3.1`                                           |
| TypeScript              | `6.0.3`                                            |
| Prisma / @prisma/client | `7.10.1`                                           |
| TailwindCSS             | `4.3.5` (native `@theme`, no `tailwind.config.js`) |
| Zod                     | `4.6.7`                                            |
| @tanstack/react-table   | `9.3.1`                                            |
| Recharts                | `3.10.1`                                           |
| ESLint                  | `10.15.0`                                          |
| next-cloudinary         | `7.1.0`                                            |
| next-mdx-remote         | `6.0.0`                                            |
| next-themes             | `0.4.6`                                            |
| lucide-react            | `1.73.0`                                           |
| jose                    | `6.2.17`                                           |

### Typography

**Baloo Bhaijaan 2** (Google Fonts, variable 400–800) is the site font for both apps. It is
self-hosted by `next/font/google` with the `arabic` + `latin` subsets and exposed as the
`--font-baloo` CSS variable, wired into Tailwind as `font-sans`.

The root layout renders `<html lang="fa" dir="rtl">`. If you want to run the UI
left-to-right instead, change that one attribute in `src/app/layout.tsx`.

## 🏃 Getting started

```bash
git clone https://github.com/avaluashop/avaluashop
cd avaluashop

# single install — one package, no workspaces
npm install

# configure env
cp .env.example .env
```

Fill in the variables (see [Environment variables](#-environment-variables)), then create the
database schema and seed demo data:

```bash
npm run db:push
npm run db:seed
```

No PostgreSQL handy? `bash scripts/dev-db.sh` provisions one for you: it installs the server if it is
missing, initialises a disposable cluster in `/tmp/avaluashop-pgdata`, starts it on
`127.0.0.1:5432`, pushes the Prisma schema and seeds demo data. It is idempotent, so re-running it is free — which is exactly what
you want after a container restart, when the binaries are gone but the data directory survived.

```bash
npm run db:up       # up + schema + seed   (bash scripts/dev-db.sh up)
npm run db:status   # is it running?
npm run db:down     # stop
```

Run the app:

```bash
npm run dev              # http://localhost:3000              (storefront)
                         # http://localhost:3000/admin/login  (admin panel)
```

Other useful scripts:

```bash
npm run build            # production build
npm run typecheck        # tsc --noEmit
npm run lint             # eslint . — one root config, storefront + admin
npm run format           # prettier
npm run test:e2e         # end-to-end against a live build + database
npm run test:stress      # load / soak
```

## 🔑 Environment variables

The app reads these from `.env` at the repository root:

| Variable                                                  | Required | Notes                                               |
| --------------------------------------------------------- | -------- | --------------------------------------------------- |
| `DATABASE_URL`                                            | ✅       | PostgreSQL connection string (Neon, Supabase, RDS…) |
| `JWT_SECRET_KEY`                                          | ✅       | Random 32+ char string used to sign session tokens  |
| `NEXT_PUBLIC_URL`                                         | ✅       | Public base URL of the app                          |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`                       | ✅       | Cloudinary cloud for product images                 |
| `NEXT_PUBLIC_GOOGLE_OAUTH_ID` / `GOOGLE_OAUTH_SECRET`     | ➖       | Enables Google sign-in                              |
| `MAIL_SMTP_SERVICE` / `MAIL_SMTP_USER` / `MAIL_SMTP_PASS` | ➖       | Outgoing mail for OTP + invoices                    |

Never commit `.env` — only `.env.example` is tracked.

## 🗄 Database

Prisma ORM works with any PostgreSQL database.

Prisma 7 uses a driver adapter (`@prisma/adapter-pg`) and reads the connection string from
`prisma.config.ts` rather than from `schema.prisma`. The client is generated into
`src/generated/prisma` on `postinstall`.

```bash
npm run db:push     # apply schema
npm run db:seed     # seed demo data
npm run db:studio   # browse data
```

There is a **single** schema at `prisma/schema.prisma` shared by the storefront and the admin
panel (previously two identical copies that had to be kept in sync by hand).

## 🛸 Deploying

It is now **one Vercel project**:

| Setting        | Value                   |
| -------------- | ----------------------- |
| Root Directory | `.` (repository root)   |
| Framework      | Next.js (auto-detected) |
| Build Command  | `next build` (default)  |

Set the environment variables from the table above, then deploy.

```bash
vercel
```

One domain serves everything: `/` is the storefront, `/admin` is the admin panel.

## 🧹 Design-system linting

Linting is not just "does it parse". The repo runs [`@shadcn/lint`](https://github.com/shadcn-ui/lint)
across every `.ts`/`.tsx` file in the repository — storefront **and** admin — and **all six rules are
errors**. They are not advisory, and they are all currently at zero.

| rule                     | what it enforces                                                            | findings |
| ------------------------ | --------------------------------------------------------------------------- | -------- |
| `no-restyle`             | a primitive owns its colour/typography/shape/motion; callers pick a variant | **0**    |
| `no-raw-colors`          | no `neutral-200`, `red-700`, `zinc-900`… — only theme tokens                | **0**    |
| `no-arbitrary-values`    | nothing off the spacing/radius/type scale                                   | **0**    |
| `no-inline-styles`       | no `style={{…}}` for anything a class can express                           | **0**    |
| `no-unknown-classes`     | every class must be one Tailwind actually emits                             | **0**    |
| `require-static-classes` | class lists must be static strings, so they can be analysed                 | **0**    |

`no-restyle` allows `layout` and `spacing` (composition at the page level is normal); everything
else must live in the primitive. `no-arbitrary-values` allows only intrinsically relational
geometry — viewport units, percentages, `calc()`, `inherit` — everything else must be a token.

**There are no warnings.** `npm run lint` is `eslint . --max-warnings 0`, so a single warning fails
the build exactly like an error does. The current run is **0 problems across 238 files**.

That covers all **729 rules: 601 at `error`, 0 at `warn`, 128 off** (each off-rule for a stated
reason). Eight plugins are stacked on top of `eslint-config-next`: `typescript-eslint`
(`strictTypeChecked` + `stylisticTypeChecked`, i.e. full type-aware linting through
`projectService`), `unicorn`, `sonarjs`, `import-x`, `jsx-a11y` (the `strict` preset),
`eslint-comments`, `no-secrets` and `security` — the last two promoted to `error` rule by rule.
`eslint-config-next` ships 24 of its own rules at `warn` and switches off
`react/jsx-no-target-blank`; those are raised to `error` in the root config too. The full list and
the per-plugin counts live in `eslint.config.mjs`.

Everything the stricter set surfaced was fixed at the source — 3,379 findings on the first
type-aware run, 0 now. No `eslint-disable` comment exists anywhere in the tree: the last three
(file-level `no-img-element` and an unnamed `eslint-disable-next-line` in `CompareImage`, plus a
`@ts-ignore` on the legacy `defaultProps` bag) were replaced with `<Image fill>`, a complete
dependency array and destructured parameter defaults.

The React 19 compiler rules are on and clean too. `react-hooks/set-state-in-effect` used to have 19
findings; all three idioms behind them were replaced rather than muted:

| idiom                                                             | replacement                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `useState(false)` + `useEffect(() => setMounted(true), [])`       | `useIsClient()` — `useSyncExternalStore` with a `false` server snapshot  |
| `useEffect(() => setValue(prop), [prop])`                         | `useSyncedState(prop)` — React's documented "adjust state during render" |
| copying a value into state from an effect (user, cart, `loading`) | derive it during render, or read it as an external store                 |

The guest cart is now a real external store (`useLocalCart`), and `loading` in the user context is
`authenticated && user === null` instead of a second piece of state kept in sync by hand.

Two narrowly-scoped exemptions remain, both because the rule cannot physically be satisfied:

- `src/emails/**` — react-email renders through its own `<Tailwind>` runtime, which knows the stock
  palette but not this project's `@theme` tokens; a semantic token would emit
  `hsl(var(--…))` into an email client with no stylesheet to resolve it. `no-inline-styles`,
  `no-raw-colors` and `no-arbitrary-values` are off for these three files. The other three rules
  still apply.
- `src/components/native/CompareImage.tsx` — a before/after slider that measures natural pixel
  dimensions at runtime and writes them into transforms. Only `no-inline-styles` is off.

### What the linter actually caught

Enabling it was not cosmetic. It found genuine breakage:

- `callout`, `tweet`, `author` and `origin-top-center` were **not real Tailwind classes** — no CSS
  was ever generated for them, so those styles silently did nothing.
- `destructive` on toast actions was a dead marker class; those selectors now key off
  `data-variant="destructive"`, matching upstream shadcn.
- `border-neutral-200 bg-white dark:bg-neutral-700`-style pairs were hardcoded duplicates of the
  theme. All 46 distinct raw colours (132 usages) now go through semantic tokens, which is also why
  dark mode stopped needing hardcoded overrides.

## 🧪 Tests

Two suites, both real: they boot the production build (`next start`) against a live PostgreSQL and
talk to it over HTTP.

```bash
npm run test:e2e      # 79 assertions
npm run test:stress   # 9 assertions, ~55s
npm test              # both
```

`DATABASE_URL` and a seeded database are required (`npm run db:push && npm run db:seed`). The suites
default to `postgresql://shop:shop@127.0.0.1:5432/avaluashop`; override with the `DATABASE_URL`
environment variable. `TEST_PORT` changes the port (default `3100`) — the harness refuses to start
if something already answers there, so you never accidentally test a stale build.

**`test:e2e`** covers:

- every page renders, and every gated page redirects anonymous visitors to its login screen
- every `/api/**` route answers without redirecting and with a non-empty body
- the full auth matrix: anonymous → 401, invalid token → 401 + cookie cleared, valid → 200
- a **real OTP login** (`otp/email/try` → read the code → `otp/email/verify`), not a forged token
- the storefront contract: purchasable items stay purchasable (price > 0, buy control present) and
  the cart accepts, updates and removes a real product
- a full admin **create → read → update → delete** cycle against the database
- validation (missing title → 400) and authorisation (anonymous write → 401, nothing persisted)
- RTL, the Baloo Bhaijaan 2 font stack, and page-weight sanity

It found four real defects on its first run, all now fixed: `DELETE /api/admin/brands/[id]` hit
`prisma.category` and returned 500, `GET /api/profile` returned 500 for an unverified account, both
logout endpoints redirected instead of answering 200, and the admin brand route's log tags were
copy-pasted from categories.

**`test:stress`** ramps 10 → 25 → 50 → 100 concurrent closed-loop clients for 10s each over real
keep-alive sockets, then a 50-client authenticated API burst, then a 400-request simultaneous spike.
It asserts zero dropped connections, zero 5xx, every response a 200, p95 under 4s, throughput that
does not collapse, and server RSS that does not run away. Latest run: **5,894 requests, 0 errors,
peak 228 req/s** (authenticated JSON), 400/400 on the spike, 228 MB → 396 MB RSS.

## 📝 Notes

- Database-backed routes render dynamically (`export const dynamic = 'force-dynamic'`), so new
  products and orders appear immediately and `next build` does not require a live database.
- `middleware.ts` has been migrated to Next 16's `proxy.ts`.
- Any `NODE_ENV=production next build` production build is what the test suites run against.
- MIT licensed — see [LICENSE.md](./LICENSE.md). Original work © Sesto-Dev.
