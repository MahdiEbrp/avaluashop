/** Persian-aware slugifier with the upstream contract: `slugify(string)`. */
export const slugify = (input: string) =>
   input
      .normalize('NFKD')
      .replaceAll(/[\u064B-\u0652]/g, '')
      .replaceAll(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replaceAll(/\s+/g, '-')
      .toLowerCase()
