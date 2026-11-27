/**
 * Runs once when the Node.js server starts. A missing or short JWT secret is a
 * deployment error, so it fails the boot instead of the first login.
 */
export async function register() {
   if (process.env.NEXT_RUNTIME !== 'nodejs') return

   const { jwtSecret } = await import('@/lib/jwt')

   jwtSecret()
}
