/**
 * The Address lookup's pure half: the shapes we hand the browser, and the
 * mapping from Ideal Postcodes' records onto them.
 *
 * Nothing here talks to the network or to Redis — that is the route handler's
 * job (`app/api/address-lookup/route.ts`). Keeping the mapping separate is what
 * lets the vendor be swapped by rewriting one file: the wizard only ever sees
 * `Suggestion` and `LookupAddress`, never a vendor field name.
 */

/** One row of the type-ahead list. `id` is opaque — the browser hands it back
 *  to resolve the full address, and never parses it. */
export type Suggestion = {
  id: string;
  label: string;
};

/** A resolved address, already shaped for the fields it will fill. */
export type LookupAddress = {
  line1: string;
  line2: string;
  town: string;
  /** The API's canonical spaced form ("ID1 1QD"), not what the visitor typed. */
  postcode: string;
  organisation: string;
};

/** One hit from the autocomplete endpoint. Requesting these is free; only
 *  resolving an `id` into a full address draws down a credit. */
export type IdealPostcodesHit = {
  id?: string;
  suggestion?: string;
};

/**
 * The subset of the Ideal Postcodes address record we read.
 *
 * Deliberately a local interface rather than the vendor's own `GbrAddress`:
 * that is a six-member union, and this repo's tsconfig has `strict: false`,
 * which disables the narrowing that would make a union usable here.
 */
export type IdealPostcodesAddress = {
  line_1?: string;
  line_2?: string;
  line_3?: string;
  post_town?: string;
  postcode?: string;
  organisation_name?: string;
};

/** Below this, a query matches most of the country and the list is just noise. */
export const MIN_QUERY_LENGTH = 3;

/** Cache-key form for a type-ahead query: collapsed whitespace, lower case. */
export function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * PAF stores the post town upper case ("LONDON"). Shown as-is it reads as
 * shouting next to every other field, so titleise it — the vendor's own widget
 * does the same thing by default.
 *
 * Hyphens and apostrophes are word boundaries too, or "STOKE-ON-TRENT" comes
 * back as "Stoke-on-trent".
 */
export function titleizeTown(town: string): string {
  return town
    .toLowerCase()
    .replace(
      /(^|[\s\-'])([a-z])/g,
      (_, sep: string, ch: string) => sep + ch.toUpperCase(),
    );
}

/** Autocomplete hits -> the list the browser renders. */
export function toSuggestions(hits: IdealPostcodesHit[]): Suggestion[] {
  return hits
    .map((h) => ({
      id: (h.id ?? "").trim(),
      label: (h.suggestion ?? "").trim(),
    }))
    .filter((s) => s.id && s.label);
}

/** One resolved vendor record -> the fields the wizard fills. */
export function toLookupAddress(a: IdealPostcodesAddress): LookupAddress {
  // line_3 is rare (a named building above a flat number). Folding it into
  // line 2 keeps every part of the address rather than dropping it: the form
  // asks for two address lines and PAF keeps three.
  const line2 = [a.line_2, a.line_3]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");

  return {
    line1: (a.line_1 ?? "").trim(),
    line2,
    town: titleizeTown((a.post_town ?? "").trim()),
    postcode: (a.postcode ?? "").trim(),
    organisation: (a.organisation_name ?? "").trim(),
  };
}
