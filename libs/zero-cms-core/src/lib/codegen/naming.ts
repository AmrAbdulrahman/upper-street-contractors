/** Identifier helpers for codegen. `blog-post` -> `BlogPost` / `blogPost`. */

function words(name: string): string[] {
  return name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function pascalCase(name: string): string {
  return words(name)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

export function camelCase(name: string): string {
  const p = pascalCase(name);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/**
 * Words that are never title-cased because they are not words — an editor reads
 * "Sidebar CTA", not "Sidebar Cta". Keyed by the lowercased word, so the map is
 * consulted after {@link words} has already split the identifier.
 *
 * `img` and `href` are expansions rather than acronyms: both are abbreviations
 * an editor has no reason to meet, and there is exactly one sensible reading of
 * each in a CMS field name.
 */
const ACRONYMS: Record<string, string> = {
  url: 'URL',
  cta: 'CTA',
  faq: 'FAQ',
  id: 'ID',
  seo: 'SEO',
  cms: 'CMS',
  api: 'API',
  html: 'HTML',
  css: 'CSS',
  img: 'Image',
  href: 'Link',
  whatsapp: 'WhatsApp',
};

/** Kept lowercase mid-phrase, so `listOfPoints` reads "List of Points". */
const SMALL_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'of', 'to', 'for', 'in', 'on', 'and', 'or', 'at', 'by', 'with',
]);

/**
 * A field or Type `__name` as a human label: `doneTitle` -> "Done Title",
 * `middle_name` -> "Middle Name", `sidebarCta` -> "Sidebar CTA".
 *
 * The FALLBACK, never an override — an explicit `label` in the Schema always
 * wins. It exists because most fields carry no `label`, and a raw identifier in
 * a form is a thing only the person who typed the schema can read.
 *
 * It cannot fix a key with no word boundary in it (`lastname` stays
 * "Lastname"); that one needs a real `label`.
 */
export function humanize(name: string): string {
  const parts = words(name);
  if (!parts.length) return name;
  return parts
    .map((w, i) => {
      const lower = w.toLowerCase();
      const acronym = ACRONYMS[lower];
      if (acronym) return acronym;
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}
