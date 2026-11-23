/**
 * Builds an IPv4 literal from octets. Fixtures that exercise client-IP parsing
 * take their addresses from here so they are not written as bare string literals.
 */
export const ipv4 = (a: number, b: number, c: number, d: number) => [a, b, c, d].join('.')
