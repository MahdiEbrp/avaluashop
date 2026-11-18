/**
 * Stand-in for the generated Prisma client (git-ignored, engine-backed).
 * Nothing in the test suite talks to a database, so the runtime value only has
 * to be constructible; the type surface is exercised through `@/types/prisma`.
 */
export class PrismaClient {
   constructor(public readonly options?: unknown) {}
}

export class Prisma {
   static readonly sql = () => 'sql'
}

export const PrismaPromise = Promise

export type PrismaClientKnownRequestError = Error
