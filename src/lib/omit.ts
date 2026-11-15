/* Strips the given keys from a user record before it leaves the server.
   Rebuilt from entries instead of `delete` so the shape stays immutable. */
export function omitUser<User extends object, Key extends keyof User>(
   user: User,
   ...keys: Key[]
): Omit<User, Key> {
   const entries = Object.entries(user).filter(
      ([key]) => !keys.includes(key as Key)
   )

   return Object.fromEntries(entries) as Omit<User, Key>
}
