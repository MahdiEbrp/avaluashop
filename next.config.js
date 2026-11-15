/** @type {import('next').NextConfig} */

/**
 * Content-Security-Policy.
 *
 * `script-src` needs `'unsafe-inline'`: Next inlines its hydration bootstrap
 * and the RSC payload, and a nonce would force every route to render
 * dynamically (the nonce has to be generated per request). The trade is
 * deliberate and the app contains exactly one `dangerouslySetInnerHTML` (the
 * analytics snippet in `GoogleAnalytics.tsx`), so there is no user-controlled
 * markup for an inline-payload attack to reach. Everything that actually
 * matters is locked down: no external script origins, no framing, no plugins,
 * no base-uri rewriting.
 */
const contentSecurityPolicy = [
   "default-src 'self'",
   "script-src 'self' 'unsafe-inline'",
   "style-src 'self' 'unsafe-inline'",
   "img-src 'self' data: blob: https:",
   "font-src 'self' data:",
   "connect-src 'self' https:",
   "media-src 'self' https:",
   "object-src 'none'",
   "base-uri 'self'",
   "form-action 'self'",
   "frame-ancestors 'none'",
   'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
   { key: 'Content-Security-Policy', value: contentSecurityPolicy },
   // Clickjacking: the admin panel must never render inside someone's frame.
   { key: 'X-Frame-Options', value: 'DENY' },
   { key: 'X-Content-Type-Options', value: 'nosniff' },
   { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
   {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
   },
   // Two years, subdomains included. Ignored over plain HTTP, so it is safe in
   // local development too.
   {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
   },
   { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

module.exports = {
   // Do not advertise the framework version to scanners.
   poweredByHeader: false,
   images: {
      // AVIF is ~30% smaller than WebP at the same quality; Next negotiates it
      // from the Accept header and falls back to WebP and then the original.
      formats: ['image/avif', 'image/webp'],
      minimumCacheTTL: 2_678_400,
      remotePatterns: [
         {
            protocol: 'https',
            hostname: '**',
         },
      ],
   },
   experimental: {
      // Tree-shake barrel-file libraries: only the icons/components actually
      // imported end up in the client bundle.
      optimizePackageImports: [
         'lucide-react',
         'date-fns',
         'recharts',
         'embla-carousel-react',
         '@radix-ui/react-icons',
      ],
   },
   async headers() {
      return [{ source: '/(.*)', headers: securityHeaders }]
   },
   async redirects() {
      return [
         {
            source: '/product',
            destination: '/products',
            permanent: true,
         },
      ]
   },
}
