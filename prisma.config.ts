import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma 7 moved the connection URL out of schema.prisma and no longer loads
// .env automatically, hence the explicit dotenv import above.
export default defineConfig({
   schema: 'prisma/schema.prisma',
   datasource: {
      url: process.env.DATABASE_URL,
   },
   migrations: {
      seed: 'tsx prisma/seed.ts',
   },
})
