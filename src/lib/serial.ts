/* Voucher serials. `Math.random()` is fine for a discount code in the sense
   that nothing secret is derived from it, but it is predictable enough to let
   two clients collide, so these come from the platform CSPRNG instead. */
function randomFraction(): number {
   const buffer = new Uint32Array(1)
   globalThis.crypto.getRandomValues(buffer)
   return buffer[0] / 2 ** 32
}

export function generateSerial({
   batchCount = 1,
   batchSize = 5,
   alphanumeric = false,
}: Readonly<{
   batchCount?: number
   batchSize?: number
   alphanumeric?: boolean
}>) {
   function generateAlphanumerics(): string {
      let generation = ''

      while (generation.length != batchSize) {
         generation = randomFraction()
            .toString(36)
            .slice(2)
            .toUpperCase()
            .padEnd(batchSize, '0')
      }

      return generation
   }

   function generateNumerics(): string {
      let generation = ''

      while (generation.length != batchSize) {
         generation = Math.floor(randomFraction() * 10 ** batchSize)
            .toString()
            .padStart(batchSize, '0')
      }

      return generation
   }

   const segments: string[] = []

   for (let i = 0; i < batchCount; i++) {
      segments.push(alphanumeric ? generateAlphanumerics() : generateNumerics())
   }

   return segments.join('-')
}
