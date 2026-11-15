# AGENTS.md

Operating notes for AI agents working in this repository. Read this before editing;
`README.md` covers features and user-facing setup.

## What this is

**One** Next.js application serving two surfaces:

- storefront at `/` (Persian, RTL)
- admin panel at `/admin` (login at `/admin/login`)

There is a single `package.json` and one lockfile at the repository root. There are no
workspaces, no `-w` flags, and no per-package `node_modules`. Do not introduce a monorepo.

## Stack

| Concern    | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | Next.js 16.4.6 (App Router, RSC, Turbopack)                    |
| UI runtime | React 19.3.1                                                   |
| Language   | TypeScript 6                                                   |
| Styling    | Tailwind CSS 4 via `@tailwindcss/postcss`, shadcn/ui (new-york) |
| Data       | Prisma 7 + `@prisma/adapter-pg` + PostgreSQL                   |
| Auth       | `jose` JWT in an httpOnly cookie, enforced in `src/proxy.ts`    |
| Validation | `zod`                                                          |

Node `>=20` is required (`engines` in `package.json`).

## Commands

```bash
npm install            # runs `prisma generate` on postinstall
npm run dev            # next dev on 0.0.0.0:3000
npm run build          # next build
npm run lint           # eslint . --max-warnings 0   <- warnings fail the build
npm run typecheck      # tsc --noEmit
npm run format         # prettier over src/**/*.{ts,tsx,md,json}

npm test               # e2e then stress
npm run test:e2e       # node tests/e2e.mjs
npm run test:stress    # node tests/stress.mjs

npm run db:up          # disposable local PostgreSQL (scripts/dev-db.sh)
npm run db:down
npm run db:status
npm run db:push        # prisma db push
npm run db:reset       # prisma db push --force-reset
npm run db:seed        # tsx prisma/seed.ts
npm run db:studio
```

Always finish with `npm run lint && npm run typecheck`. Both are cheap and gated in CI;
`lint` treats every warning as an error.

The test suites expect a **running server and a seeded database**; they are not unit tests.

## Layout

```
src/
├── app/
│   ├── (store)/          storefront pages
│   ├── admin/            (dashboard)/* and login/
│   ├── api/              storefront API   /api/*
│   ├── api/admin/        admin API        /api/admin/*
│   ├── login/
│   └── globals.css       Tailwind entry + design tokens
├── actions/              server actions (dashboard aggregates)
├── components/
│   ├── admin/            admin-specific components (+ admin/ui primitives)
│   ├── ui/               shadcn primitives
│   ├── composites/ modals/ native/
├── config/               site.ts, docs.ts
├── hooks/                client hooks (cart, auth, modals, stores)
├── lib/                  prisma, jwt, cart, catalog, order, rate-limit, utils
├── providers/ state/ types/
└── proxy.ts              single auth proxy for both surfaces

prisma/schema.prisma      one schema for everything
prisma/seed.ts            seed data
scripts/dev-db.sh         disposable local PostgreSQL
tests/                    e2e + stress (black-box HTTP)
src/generated/prisma/     generated Prisma client — gitignored, never edit
```

## Non-obvious things that will bite you

- **`src/proxy.ts`, not `middleware.ts`.** Next 16 renamed the convention. It guards
  `/profile/**`, `/admin/**`, `/api/**`, and `/api/admin/**`. Public: `/api/auth*`,
  `/api/admin/auth*`, `/api/health`, `/admin/login`. Add new public routes there or they 401.
- **Prisma 7 layout.** The client is generated to `src/generated/prisma` (see the `generator`
  block), and the connection URL comes from `prisma.config.ts`, not `schema.prisma`.
  Prisma 7 no longer reads `.env` on its own — `prisma.config.ts` imports `dotenv/config`
  for exactly that reason. Import the client from `@/generated/prisma/client` (existing code
  often uses a relative path because that folder is not generated until install time).
- **TypeScript strictness is deliberately off.** `strict` and `strictNullChecks` are `false`.
  Do not flip them on as a drive-by cleanup; it is a separate, very large change.
- **`next-env.d.ts` is generated.** Never hand-edit it.
- **`.env` is gitignored; `.env.example` is the source of truth** for configuration keys.

## Code conventions

These are enforced, not preferences:

- **Path alias** `@/*` → `src/*`. Import ordering and grouping are fixed by
  `@trivago/prettier-plugin-sort-imports` — let Prettier rewrite imports instead of
  hand-sorting them.
- **Prettier** (`.prettierrc`): 3-space indent, **no semicolons**, single quotes,
  `trailingComma: es5`, Tailwind classes auto-sorted.
- **ESLint flat config** (`eslint.config.mjs`) with `--max-warnings 0`. Notable enforced rules:
  - `@shadcn/lint` design-system rules: `no-raw-colors`, `no-inline-styles`,
    `no-unknown-classes`, `require-static-classes`, `no-arbitrary-values`, and
    `no-restyle` (only layout/spacing may be overridden).
  - Use design tokens and `cn()` from `@/lib/utils`; never hardcode colors or inline styles.
  - `react-hooks/*` rules are errors: no `set-state-in-effect`, no impure renders,
    no components created during render.
- **Server vs client.** Server components are the default; `'use client'` only where
  interactivity or hooks are required. Data mutations go through `src/actions/` server
  actions or route handlers under `src/app/api/`, not ad-hoc fetch calls in components.

## Configuration

Only two variables are required: `DATABASE_URL` and `JWT_SECRET_KEY` (32+ random chars).
Everything else is optional and degrades gracefully:

- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — admin image upload
- `NEXT_PUBLIC_GOOGLE_OAUTH_ID` + `GOOGLE_OAUTH_SECRET` — Google sign-in
- `MAIL_SMTP_*` — OTP and invoice mail; without it the OTP is logged to the server console
- `NEXT_PUBLIC_URL` — absolute URLs

Copy `.env.example` to `.env`; never commit real secrets.

## When you change something

1. Keep the change inside the existing structure. No new top-level directories, no new
   package manager, no second schema.
2. If you touch a Prisma model, update `prisma/seed.ts` when it consumes that model, then
   run `npm run db:push` and `npm run db:seed`.
3. If you add a public route, update the whitelist in `src/proxy.ts`.
4. If you add a dependency, use `npm install` (not a second lockfile) and respect
   `legacy-peer-deps` from `.npmrc`.
5. Run `npm run lint && npm run typecheck` before reporting done.
