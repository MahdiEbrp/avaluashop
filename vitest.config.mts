import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

const stub = (name: string) =>
   fileURLToPath(new URL(`./tests/stubs/${name}.ts`, import.meta.url))

export default defineConfig({
   plugins: [react(), tsconfigPaths()],
   resolve: {
      alias: [
         /* The Prisma client is generated at install time into a git-ignored
            folder and needs a real database engine. Tests never talk to a
            database, so the client is replaced by a constructible stub. */
         {
            find: /^@\/generated\/prisma\/client$/,
            replacement: stub('prisma-client'),
         },
         {
            find: /^\.\.\/generated\/prisma\/client$/,
            replacement: stub('prisma-client'),
         },
         /* Google Fonts are downloaded at build time; the loader only has to
            yield a css variable name. */
         { find: /^next\/font\/google$/, replacement: stub('next-font-google') },
         { find: /^next-cloudinary$/, replacement: stub('next-cloudinary') },
         { find: /^@persepolis\/mail$/, replacement: stub('persepolis-mail') },
         { find: /^@persepolis\/sms$/, replacement: stub('persepolis-sms') },
         {
            find: /^@persepolis\/regex$/,
            replacement: stub('persepolis-regex'),
         },
         {
            find: /^@persepolis\/slugify$/,
            replacement: stub('persepolis-slugify'),
         },
         { find: /^@persepolis\/rng$/, replacement: stub('persepolis-rng') },
      ],
   },
   test: {
      projects: [
         {
            /* Server-side surface: route handlers, libs, actions, the proxy.
               Node keeps WebCrypto and jose in a single realm. */
            extends: true,
            test: {
               name: 'server',
               environment: 'node',
               include: ['tests/unit/**/*.test.ts'],
            },
         },
         {
            /* Browser-facing surface: components, hooks, providers. */
            extends: true,
            test: {
               name: 'client',
               environment: 'jsdom',
               include: ['tests/unit/**/*.test.tsx'],
            },
         },
      ],
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      css: false,
      testTimeout: 20_000,
      coverage: {
         provider: 'v8',
         reporter: ['text', 'json-summary', 'html'],
         reportsDirectory: './coverage',
         include: ['src/**/*.{ts,tsx}'],
         /* Generated Prisma output is not hand-written; `src/types` holds
            interface-only modules with no runtime code to execute. */
         exclude: ['src/generated/**', 'src/types/**'],
         thresholds: {
            lines: 100,
            functions: 100,
            branches: 100,
            statements: 100,
         },
      },
   },
})
