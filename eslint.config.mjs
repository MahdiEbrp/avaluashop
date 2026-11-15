import eslintComments from '@eslint-community/eslint-plugin-eslint-comments'
import shadcn from '@shadcn/lint'
import next from 'eslint-config-next/core-web-vitals'
import importX from 'eslint-plugin-import-x'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import noSecrets from 'eslint-plugin-no-secrets'
import security from 'eslint-plugin-security'
import sonarjs from 'eslint-plugin-sonarjs'
import unicorn from 'eslint-plugin-unicorn'
import tseslint from 'typescript-eslint'

/**
 * Single lint config for the whole repository.
 *
 *   1. Next.js / React / TypeScript rules   (eslint-config-next)
 *   2. Design-system rules                  (@shadcn/lint — all 6 rules enabled)
 *   3. typescript-eslint strict  (strictTypeChecked + stylisticTypeChecked)
 *   4. unicorn / sonarjs / import-x / jsx-a11y strict / eslint-comments / secret + security guards
 *
 * The app is a single package: the admin panel lives at src/app/admin, so one
 * pass covers storefront + admin.
 */

/* Everything is linted with type information. `projectService` resolves the one
   tsconfig at the repo root automatically. */
const TS_FILES = ['**/*.{ts,tsx}']
const typed = [
   {
      files: TS_FILES,
      languageOptions: {
         parserOptions: {
            projectService: true,
            tsconfigRootDir: import.meta.dirname,
         },
      },
   },
]

const config = [
   ...next,
   {
      ignores: [
         '**/node_modules/**',
         '**/.next/**',
         '**/src/generated/**',
         '**/*.config.{js,mjs,ts}',
         '**/next-env.d.ts',
      ],
   },

   /* ---------------- @shadcn/lint: design system ---------------- */
   /* All six rules at "error". The design system is enforced, not advisory:
      the palette is fully tokenised, off-scale values are gone, primitives own
      their own variants, and every class name is one Tailwind actually emits. */
   {
      files: TS_FILES,
      plugins: { shadcn },
      rules: {
         'shadcn/no-restyle': ['error', { allow: ['layout', 'spacing'] }],
         'shadcn/no-raw-colors': 'error',
         'shadcn/no-inline-styles': 'error',
         'shadcn/no-unknown-classes': 'error',
         'shadcn/require-static-classes': 'error',
         // The only arbitrary values left are intrinsically relational geometry
         // (viewport units, percentages, calc(), `inherit`). Nothing else may
         // leave the token scale.
         'shadcn/no-arbitrary-values': [
            'error',
            {
               allow: [
                  '*-[*vh]',
                  '*-[*vw]',
                  'h-[calc(*)]',
                  'top-[*%]',
                  'rounded-[inherit]',
                  'lg:grid-cols-[.75fr_1fr]',
               ],
            },
         ],
      },
   },

   /* Emails are the one place the design system genuinely cannot reach:
      react-email renders them through its own <Tailwind> runtime, which knows
      the stock palette but nothing about this project's @theme tokens — a
      class like `text-muted-foreground` would emit `hsl(var(--muted-…))` into
      an email client that has no stylesheet to resolve it against. So raw
      palette values and literal sizes are correct here.
      Every other shadcn rule still applies to these files. */
   {
      files: ['src/emails/**/*.tsx'],
      rules: {
         'shadcn/no-inline-styles': 'off',
         'shadcn/no-raw-colors': 'off',
         'shadcn/no-arbitrary-values': 'off',
      },
   },

   /* The before/after slider measures the natural pixel geometry of the two
      images at runtime and writes it into transforms, so that one style
      attribute cannot be expressed as a class. */
   {
      files: ['src/components/native/CompareImage.tsx'],
      rules: {
         'shadcn/no-inline-styles': 'off',
      },
   },

   /* eslint-config-next ships these at "warn". Nothing may sit at warn, so they
      are raised to "error" like everything else. */
   {
      rules: {
         '@next/next/google-font-display': 'error',
         '@next/next/google-font-preconnect': 'error',
         '@next/next/next-script-for-ga': 'error',
         '@next/next/no-async-client-component': 'error',
         '@next/next/no-before-interactive-script-outside-document': 'error',
         '@next/next/no-css-tags': 'error',
         '@next/next/no-head-element': 'error',
         '@next/next/no-img-element': 'error',
         '@next/next/no-location-assign-relative-destination': 'error',
         '@next/next/no-page-custom-font': 'error',
         '@next/next/no-styled-jsx-in-document': 'error',
         '@next/next/no-title-in-document-head': 'error',
         '@next/next/no-typos': 'error',
         '@next/next/no-unwanted-polyfillio': 'error',
         'import/no-anonymous-default-export': 'error',
         'jsx-a11y/alt-text': 'error',
         'jsx-a11y/aria-props': 'error',
         'jsx-a11y/aria-proptypes': 'error',
         'jsx-a11y/aria-unsupported-elements': 'error',
         'jsx-a11y/role-has-required-aria-props': 'error',
         'jsx-a11y/role-supports-aria-props': 'error',
         'react-hooks/exhaustive-deps': 'error',
         'react-hooks/incompatible-library': 'error',
         'react-hooks/unsupported-syntax': 'error',
      },
   },

   /* eslint-config-next switches these off for the Next profile. They are worth
      having: one is an XSS guard, one catches misspelled attributes. The two
      left off are obsolete rather than inconvenient — `react-in-jsx-scope` was
      replaced by the automatic runtime in React 17, and `prop-types` is what
      TypeScript already does here. */
   {
      rules: {
         'react/jsx-no-target-blank': 'error',
         // cmdk's documented styling hook, used by `[&_[cmdk-input-wrapper]_svg]`.
         'react/no-unknown-property': [
            'error',
            { ignore: ['cmdk-input-wrapper'] },
         ],
         'react/no-unsafe': 'error',
      },
   },

   /* App Router only — there is no `pages/` directory for this rule to inspect,
      so it can only ever print a "Pages directory cannot be found" notice. */
   {
      rules: {
         '@next/next/no-html-link-for-pages': 'off',
      },
   },

   /* ---------------- React 19 hook rules ---------------- */
   /* Nothing here is advisory. The three rules that React 19 introduced were
      fixed rather than muted:
        - `static-components`: inline helper components became render helpers
        - `purity`: the Math.random() skeleton keys that broke hydration are gone
        - `set-state-in-effect`: the mounted-guard idiom is now
          useSyncExternalStore, prop->state syncs go through useSyncedState, and
          the user/cart contexts derive loading and cart during render instead of
          writing them from an effect. */
   {
      rules: {
         'react-hooks/static-components': 'error',
         'react-hooks/purity': 'error',
         'react-hooks/set-state-in-effect': 'error',
      },
   },

   /* ================= typescript-eslint: strict, type-aware ================= */
   /* https://typescript-eslint.io/users/configs/ — `strictTypeChecked` is the
      strictest shipped preset (it is a superset of recommended > strict), and
      `stylisticTypeChecked` adds the opinionated-but-consistent half. Both need
      real type information, hence `projectService` below. */
   ...tseslint.configs.strictTypeChecked.map((c) => ({
      ...c,
      files: TS_FILES,
   })),
   ...tseslint.configs.stylisticTypeChecked.map((c) => ({
      ...c,
      files: TS_FILES,
   })),
   ...typed,

   /* The `no-unsafe-*` family and the nullability rules are switched off on
      purpose, with the reason attached to each one, because this project does
      not run TypeScript in strict mode (`tsconfig.json` has
      `strict: false`): a rule that needs `strictNullChecks` to see `null` in a
      type cannot work without it, and `any` arrives from Prisma's generated
      payload types and from third-party `.d.ts` files, not from our code. */
   {
      files: TS_FILES,
      rules: {
         '@typescript-eslint/no-unsafe-assignment': 'off',
         '@typescript-eslint/no-unsafe-member-access': 'off',
         '@typescript-eslint/no-unsafe-call': 'off',
         '@typescript-eslint/no-unsafe-return': 'off',
         '@typescript-eslint/no-unsafe-argument': 'off',
         '@typescript-eslint/no-unnecessary-condition': 'off',
         '@typescript-eslint/no-useless-default-assignment': 'off',
         '@typescript-eslint/prefer-nullish-coalescing': 'off',
         '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
         // A number in a template literal is always rendered unambiguously
         // (`${percent}%`, `${page}`); the rule's default of "strings only"
         // would force pointless `String()` noise on arithmetic.
         '@typescript-eslint/restrict-template-expressions': [
            'error',
            { allowNumber: true },
         ],
         // `_`-prefixed names are the project's "intentionally unused" marker.
         '@typescript-eslint/no-unused-vars': [
            'error',
            {
               args: 'after-used',
               argsIgnorePattern: '^_',
               varsIgnorePattern: '^_',
               caughtErrors: 'all',
               caughtErrorsIgnorePattern: '^_',
               destructuredArrayIgnorePattern: '^_',
               ignoreRestSiblings: true,
            },
         ],
      },
   },

   /* ================= unicorn ================= */
   {
      files: TS_FILES,
      plugins: { unicorn },
      rules: {
         ...unicorn.configs.recommended.rules,
         // Abbreviation policing flags ~470 legitimate names (`img`, `id`, `db`,
         // `e`, `props`…). It is the one unicorn rule that is pure taste.
         'unicorn/prevent-abbreviations': 'off',
         // React components are PascalCase files, Next.js routes are lowercase
         // directories; a single case convention cannot hold both.
         'unicorn/filename-case': 'off',
         // `null` is meaningful here: it is what Prisma, `useRef`, the DOM and
         // the API contracts (JSON) return. Rewriting those to `undefined`
         // would change serialised payloads.
         'unicorn/no-null': 'off',
      },
   },

   /* ================= sonarjs ================= */
   {
      files: TS_FILES,
      plugins: { sonarjs },
      rules: {
         ...sonarjs.configs.recommended.rules,
      },
   },

   /* ================= eslint-comments ================= */
   /* Guards the suppressions themselves: a disable comment must name its rule
      and must be paired. The project has no suppressions left, and this keeps
      it that way. */
   {
      files: TS_FILES,
      plugins: { '@eslint-community/eslint-comments': eslintComments },
      rules: {
         ...eslintComments.configs.recommended.rules,
         '@eslint-community/eslint-comments/require-description': [
            'error',
            { ignore: [] },
         ],
      },
   },

   /* ================= import-x ================= */
   {
      files: TS_FILES,
      plugins: { 'import-x': importX },
      settings: {
         'import-x/resolver': { typescript: true, node: true },
      },
      rules: {
         'import-x/no-cycle': 'error',
         'import-x/no-self-import': 'error',
         'import-x/no-duplicates': 'error',
         'import-x/no-useless-path-segments': 'error',
         'import-x/no-absolute-path': 'error',
         'import-x/no-mutable-exports': 'error',
         'import-x/no-empty-named-blocks': 'error',
         'import-x/no-default-export': 'off',
         'import-x/order': 'off',
      },
   },

   /* ================= jsx-a11y: strict ================= */
   /* The `strict` preset adds ~15 more accessibility rules on top of the
      recommended set that eslint-config-next already ships. */
   {
      files: ['**/*.tsx'],
      rules: {
         ...jsxA11y.flatConfigs.strict.rules,
      },
   },

   /* `prisma/seed.ts` is compiled to CommonJS by `tsx`, so it cannot use
      top-level await; the rule's only suggested fix is unavailable there. */
   {
      files: ['prisma/seed.ts'],
      rules: {
         'unicorn/prefer-top-level-await': 'off',
      },
   },

   /* ================= secret + security guards ================= */
   {
      files: TS_FILES,
      plugins: { 'no-secrets': noSecrets, security },
      rules: {
         'no-secrets/no-secrets': ['error', { tolerance: 4.4 }],
         // eslint-plugin-security ships its 15 rules as "warn"; warnings are not
         // tolerated here, so the whole preset is promoted to "error".
         ...Object.fromEntries(
            Object.keys(security.configs.recommended.rules).map((rule) => [
               rule,
               'error',
            ])
         ),
         // Fires on every `obj[key]` (~21 hits) — the rule cannot tell a map
         // lookup from a prototype-pollution sink, so it reports both. The real
         // injection surface here is Prisma, which is parameterised.
         'security/detect-object-injection': 'off',
      },
   },
]

export default config
