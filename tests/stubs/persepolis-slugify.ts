/** Persian-aware slugifier with the upstream contract: `slugify(string)`. */
export const slugify = (input: string) =>
   input
      .normalize('NFKD')
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
