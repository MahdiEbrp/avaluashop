/**
 * Stress suite.
 *
 * Drives the production build with a closed-loop load generator over real HTTP
 * (keep-alive sockets, no fetch overhead) and reports throughput and latency
 * percentiles at increasing concurrency.
 *
 *   1. ramp: 10 → 25 → 50 → 100 concurrent clients, 10s each
 *   2. authenticated API burst at 50 concurrent clients
 *   3. spike: 400 simultaneous cold requests
 *   4. memory: server RSS before / after
 *
 *   npm run test:stress
 *
 * Thresholds are deliberately strict — this should fail the build if the app
 * starts returning 5xx or degrades catastrophically under load.
 */
import http from 'node:http'

import {
   BASE,
   PORT,
   check,
   closeDb,
   dbQuery,
   req,
   section,
   serverRssMiB,
   startServer,
   stopServer,
   summary,
} from './harness.mjs'

const agent = new http.Agent({ keepAlive: true, maxSockets: Infinity })

function get(path, cookie) {
   return new Promise((resolve, reject) => {
      const request = http.request(
         {
            host: '127.0.0.1',
            port: PORT,
            path,
            method: 'GET',
            agent,
            headers: cookie ? { cookie } : {},
         },
         (res) => {
            let bytes = 0
            res.on('data', (chunk) => (bytes += chunk.length))
            res.on('end', () => resolve({ status: res.statusCode, bytes }))
            res.on('error', reject)
         }
      )
      request.setTimeout(30_000, () => request.destroy(new Error('timeout')))
      request.on('error', reject)
      request.end()
   })
}

function percentile(sorted, p) {
   if (!sorted.length) return 0
   const idx = Math.min(
      sorted.length - 1,
      Math.ceil((p / 100) * sorted.length) - 1
   )
   return sorted[Math.max(0, idx)]
}

function fmt(n) {
   return n.toFixed(0).padStart(6)
}

async function runLevel({ concurrency, durationMs, paths, cookie, label }) {
   const deadline = Date.now() + durationMs
   const latencies = []
   const statuses = new Map()
   let connections = 0
   let bytes = 0
   let cursor = 0

   const started = process.hrtime.bigint()

   async function worker() {
      while (Date.now() < deadline) {
         const path = paths[cursor++ % paths.length]
         const t0 = process.hrtime.bigint()
         try {
            const res = await get(path, cookie)
            latencies.push(Number(process.hrtime.bigint() - t0) / 1e6)
            bytes += res.bytes
            statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1)
         } catch {
            connections++
         }
      }
   }

   await Promise.all(Array.from({ length: concurrency }, worker))

   const elapsed = Number(process.hrtime.bigint() - started) / 1e6
   const sorted = [...latencies].sort((a, b) => a - b)
   const server5xx = [...statuses.entries()]
      .filter(([s]) => s >= 500)
      .reduce((a, [, n]) => a + n, 0)

   const report = {
      label,
      concurrency,
      requests: latencies.length,
      rps: latencies.length / (elapsed / 1000),
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[sorted.length - 1] ?? 0,
      connections,
      server5xx,
      statuses: Object.fromEntries(
         [...statuses.entries()].sort((a, b) => a[0] - b[0])
      ),
      bytes,
   }

   console.log(
      `  ${String(report.concurrency).padStart(4)} clients │ ` +
         `${String(report.requests).padStart(5)} req │ ` +
         `${fmt(report.rps)} req/s │ ` +
         `p50 ${fmt(report.p50)}ms  p95 ${fmt(report.p95)}ms  p99 ${fmt(report.p99)}ms  max ${fmt(report.max)}ms │ ` +
         `${(report.bytes / 1024 / 1024).toFixed(1)}MB`
   )

   return report
}

async function main() {
   console.log('booting production server…')
   await startServer()

   const [product] = await dbQuery(
      'SELECT id FROM "Product" WHERE "isAvailable" = true LIMIT 1'
   )
   const [user] = await dbQuery(
      'SELECT id, email FROM "User" ORDER BY "createdAt" LIMIT 1'
   )

   /* A real session for the authenticated burst — go through the OTP route. */
   await req('/api/auth/otp/email/try', {
      method: 'POST',
      body: { email: user.email },
   })
   const [issued] = await dbQuery('SELECT "OTP" FROM "User" WHERE email = $1', [
      user.email,
   ])
   const verify = await req('/api/auth/otp/email/verify', {
      method: 'POST',
      body: { email: user.email, OTP: issued.OTP },
   })
   const cookie = verify.setCookie
      .find((c) => c.startsWith('token='))
      ?.split(';')[0]
   check(
      'session established for the authenticated burst',
      Boolean(cookie),
      verify.status
   )

   const rssBefore = serverRssMiB()

   /* ---------------------------------------------------------------- */
   section('1. Ramp — public pages, closed-loop clients')

   const mix = [
      '/',
      '/products',
      '/products',
      '/cart',
      `/products/${product.id}`,
      '/blog',
      '/login',
   ]

   const levels = [10, 25, 50, 100]
   const reports = []
   for (const concurrency of levels) {
      reports.push(
         await runLevel({
            concurrency,
            durationMs: 10_000,
            paths: mix,
            label: 'public',
         })
      )
   }

   section('2. Authenticated API burst — 50 clients on /api/products')

   const apiReport = await runLevel({
      concurrency: 50,
      durationMs: 8_000,
      paths: ['/api/products', '/api/products', '/api/cart', '/api/orders'],
      cookie,
      label: 'api',
   })

   section('3. Spike — 400 simultaneous requests')

   const spikeStarted = process.hrtime.bigint()
   const spike = await Promise.all(
      Array.from({ length: 400 }, (_, i) =>
         get(mix[i % mix.length]).catch((e) => ({ error: e.message }))
      )
   )
   const spikeMs = Number(process.hrtime.bigint() - spikeStarted) / 1e6
   const spikeErrors = spike.filter((r) => r.error || r.status >= 500).length
   const spikeOk = spike.filter((r) => r.status === 200).length
   console.log(
      `  400 concurrent │ ${(spikeMs / 1000).toFixed(2)}s wall │ ${spikeOk}/400 → 200 │ ${spikeErrors} failed`
   )

   const rssAfter = serverRssMiB()

   /* ---------------------------------------------------------------- */
   section('4. Verdict')

   const all = [...reports, apiReport]
   const totalRequests = all.reduce((a, r) => a + r.requests, 0)
   const totalConnErrors = all.reduce((a, r) => a + r.connections, 0)
   const total5xx = all.reduce((a, r) => a + r.server5xx, 0)
   const peakRps = Math.max(...all.map((r) => r.rps))

   check(
      `${totalRequests.toLocaleString()} requests completed`,
      totalRequests > 0,
      `peak ${peakRps.toFixed(0)} req/s`
   )
   check(
      'zero dropped connections',
      totalConnErrors === 0,
      `${totalConnErrors} failures`
   )
   check(
      'zero 5xx responses under load',
      total5xx === 0,
      `${total5xx} server errors`
   )
   check(
      'every response was a 200',
      all.every((r) => Object.keys(r.statuses).every((s) => s === '200')),
      JSON.stringify(
         Object.fromEntries(all.map((r) => [r.concurrency, r.statuses]))
      )
   )
   check(
      '400-request spike: no failures, no 5xx',
      spikeErrors === 0 && spikeOk === 400,
      `${spikeOk}/400 ok in ${(spikeMs / 1000).toFixed(2)}s`
   )
   check(
      'p95 latency stays under 4s even at 100 concurrent clients',
      reports.every((r) => r.p95 < 4000),
      reports.map((r) => `${r.concurrency}c=${r.p95.toFixed(0)}ms`).join(' ')
   )
   check(
      'throughput scales from 10 → 100 clients instead of collapsing',
      Math.min(...reports.map((r) => r.rps)) > 0 &&
         reports[reports.length - 1].rps >= reports[0].rps * 0.5,
      reports.map((r) => `${r.concurrency}c=${r.rps.toFixed(0)}`).join(' ') +
         ' req/s'
   )
   if (rssBefore != null && rssAfter != null) {
      check(
         'server memory did not run away',
         rssAfter < rssBefore * 2 + 200,
         `${rssBefore.toFixed(0)}MB → ${rssAfter.toFixed(0)}MB`
      )
   }

   /* Persisted results for the write-up. */
   const { writeFileSync } = await import('node:fs')
   writeFileSync(
      new URL('./stress-report.json', import.meta.url),
      JSON.stringify(
         {
            generatedAt: new Date().toISOString(),
            reports,
            apiReport,
            spike: { spikeOk, spikeErrors, spikeMs },
            rssBefore,
            rssAfter,
         },
         null,
         2
      )
   )
}

main()
   .then(async () => {
      const ok = summary()
      agent.destroy()
      stopServer()
      await closeDb()
      process.exit(ok ? 0 : 1)
   })
   .catch(async (error) => {
      console.error('\nstress crashed:', error)
      agent.destroy()
      stopServer()
      await closeDb().catch(() => {})
      process.exit(1)
   })
