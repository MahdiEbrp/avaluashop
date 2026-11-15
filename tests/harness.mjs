/**
 * Shared harness for the end-to-end and stress suites.
 *
 * Boots a real `next start` against a real PostgreSQL, gives the suites an
 * HTTP client and a few assertions, and always tears the server down again.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const APP = ROOT

export const PORT = Number(process.env.TEST_PORT ?? 3100)
export const BASE = `http://127.0.0.1:${PORT}`

export const JWT_SECRET =
   process.env.JWT_SECRET_KEY ?? 'placeholder-secret-key-at-least-32-chars-long'
export const DATABASE_URL =
   process.env.DATABASE_URL ??
   'postgresql://shop:shop@127.0.0.1:5432/avaluashop?schema=public'

/* ------------------------------------------------------------------ *
 * tiny assertion + reporting layer
 * ------------------------------------------------------------------ */

export const results = { pass: 0, fail: 0, failures: [] }

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const OFF = '\x1b[0m'

export function section(title) {
   console.log(`\n${BOLD}── ${title} ${OFF}`)
}

export function check(name, condition, detail = '') {
   if (condition) {
      results.pass++
      console.log(
         `  ${GREEN}✓${OFF} ${name}${detail ? ` ${DIM}${detail}${OFF}` : ''}`
      )
      return true
   }
   results.fail++
   results.failures.push({ name, detail })
   console.log(
      `  ${RED}✗${OFF} ${name}${detail ? ` ${RED}${detail}${OFF}` : ''}`
   )
   return false
}

export function summary() {
   const total = results.pass + results.fail
   console.log(
      `\n${BOLD}${total - results.fail}/${total} checks passed${OFF}` +
         (results.fail ? ` ${RED}(${results.fail} failed)${OFF}` : '')
   )
   if (results.fail) {
      console.log('\nFailures:')
      for (const f of results.failures)
         console.log(`  ${RED}✗${OFF} ${f.name} ${f.detail}`)
   }
   return results.fail === 0
}

/* ------------------------------------------------------------------ *
 * HTTP client
 * ------------------------------------------------------------------ */

export async function req(path, options = {}) {
   const {
      method = 'GET',
      body,
      cookie,
      headers = {},
      redirect = 'manual',
   } = options
   const started = performance.now()

   const res = await fetch(BASE + path, {
      method,
      redirect,
      headers: {
         ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
         ...(cookie ? { cookie } : {}),
         ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
   })

   const text = await res.text()
   const ms = performance.now() - started

   let json = null
   try {
      json = JSON.parse(text)
   } catch {}

   return {
      path,
      method,
      status: res.status,
      headers: res.headers,
      location: res.headers.get('location'),
      contentType: res.headers.get('content-type') ?? '',
      setCookie: res.headers.getSetCookie?.() ?? [],
      text,
      json,
      bytes: Buffer.byteLength(text),
      ms,
   }
}

/** Mint an app session JWT the same way `lib/jwt.ts` does. */
export async function mintToken(sub, role = 'user') {
   const { SignJWT } = await import('jose')
   return new SignJWT({ role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime('60m')
      .sign(new TextEncoder().encode(JWT_SECRET))
}

/* ------------------------------------------------------------------ *
 * server lifecycle
 * ------------------------------------------------------------------ */

let child = null

/** True if something is already answering on the test port. */
async function portInUse() {
   try {
      await fetch(`${BASE}/login`, {
         redirect: 'manual',
         signal: AbortSignal.timeout(1500),
      })
      return true
   } catch {
      return false
   }
}

export async function startServer() {
   const nextBin = join(ROOT, 'node_modules/next/dist/bin/next')
   if (!existsSync(nextBin))
      throw new Error(`next binary not found at ${nextBin}`)

   /* A leftover server would silently answer our readiness probe and we would
      end up testing a stale build. Refuse rather than mislead. */
   if (await portInUse()) {
      throw new Error(
         `port ${PORT} is already serving requests — stop that process or set TEST_PORT`
      )
   }

   child = spawn(
      process.execPath,
      [nextBin, 'start', '-p', String(PORT), '-H', '127.0.0.1'],
      {
         cwd: APP,
         env: {
            ...process.env,
            NODE_ENV: 'production',
            PORT: String(PORT),
            DATABASE_URL,
            JWT_SECRET_KEY: JWT_SECRET,
         },
         stdio: ['ignore', 'pipe', 'pipe'],
      }
   )

   const log = []
   child.stdout.on('data', (d) => log.push(d.toString()))
   child.stderr.on('data', (d) => log.push(d.toString()))
   child.on('exit', (code) => log.push(`[server exited: ${code}]`))

   const deadline = Date.now() + 90_000
   while (Date.now() < deadline) {
      if (child.exitCode !== null) {
         throw new Error(`server exited early:\n${log.join('')}`)
      }
      try {
         const res = await fetch(`${BASE}/login`, { redirect: 'manual' })
         if (res.ok) {
            // warm the dynamic routes so first-hit compile cost is not in the numbers
            await fetch(`${BASE}/`, { redirect: 'manual' }).catch(() => {})
            await fetch(`${BASE}/products`, { redirect: 'manual' }).catch(
               () => {}
            )
            return { url: BASE, log }
         }
      } catch {}
      await new Promise((r) => setTimeout(r, 250))
   }
   throw new Error(`server did not become ready in 90s:\n${log.join('')}`)
}

export function stopServer() {
   if (!child) return
   try {
      child.kill('SIGTERM')
   } catch {}
   child = null
}

/* ------------------------------------------------------------------ *
 * fixture lookup — reads only, never mutates
 * ------------------------------------------------------------------ */

let pool = null

export async function dbQuery(sql, params = []) {
   if (!pool) {
      const { default: pg } = await import('pg')
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 })
   }
   const { rows } = await pool.query(sql, params)
   return rows
}

export async function closeDb() {
   if (pool) await pool.end()
   pool = null
}

/** Resident set size of the server process, in MiB (Linux /proc). */
export function serverRssMiB() {
   if (!child?.pid) return null
   try {
      const status = readFileSync(`/proc/${child.pid}/status`, 'utf8')
      const m = status.match(/VmRSS:\s+(\d+) kB/)
      return m ? Number(m[1]) / 1024 : null
   } catch {
      return null
   }
}
