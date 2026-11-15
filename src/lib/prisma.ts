import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client'

// Prisma 7 requires a driver adapter instead of a `url` in the schema.
const createPrismaClient = () =>
   new PrismaClient({
      adapter: new PrismaPg({
         connectionString: process.env.DATABASE_URL,
         // The default pool is 10; under the load test the queue, not the
         // database, was the bottleneck at 100 concurrent clients.
         max: 25,
         idleTimeoutMillis: 30_000,
      }),
   })

// Attached to `global` in development to avoid exhausting the connection pool
// on hot reloads. https://pris.ly/d/help/next-js-best-practices
const globalForPrisma = globalThis as unknown as {
   prisma?: ReturnType<typeof createPrismaClient>
}

const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
