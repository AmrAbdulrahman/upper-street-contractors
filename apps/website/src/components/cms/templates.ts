import type {
  CreateFromTemplateOptions,
  SaveAsTemplateOptions,
} from "@usc/zero-cms-widget";

/**
 * What a copy shares rather than duplicates, in THIS content model.
 *
 * ADR 0017 keeps this a parameter and not a heuristic: the library cannot know
 * that a Project is standalone and a Figure is owned. The same list serves
 * Duplicate, creating from a Template, and saving one — all three are the same
 * walk, and a Type that must not be cloned must not be cloned by any of them.
 *
 * - `project` / `blog-post` / `page` — each has its own URL. A Recent Work
 *   section pins Projects; copying them would mint orphan case studies that
 *   appear nowhere and duplicate the real ones in `/projects`.
 * - `button` — every CTA band on the site points at the same two Button
 *   entries, so changing the wording once changes it everywhere. A copy would
 *   quietly opt this page out of that.
 * - `icon` — a shared glyph registry, not content.
 *
 * Media is shared too, but that needs no entry here: an `asset` field holds a
 * media id and is copied by value like any other non-reference field.
 */
export const SHARE_TYPES = [
  "project",
  "blog-post",
  "page",
  "button",
  "icon",
] as const;

/**
 * Duplicate, as distinct from Template: it copies one specific post, so its
 * root IS a copy and needs the root-only rules a Template has no use for.
 * `slug` is cleared rather than copied — zero-cms enforces no uniqueness, so a
 * duplicated slug silently shadows the original (the route takes the first
 * match). Blank, it re-derives from the new title.
 */
export const DUPLICATE_BLOG_POST = {
  shareTypes: SHARE_TYPES,
  clearFields: ["slug"],
  renameField: "title",
} as const;

/**
 * A Project copies the same way, minus the slug it does not have: a Project's
 * URL is its id. `project` being in `shareTypes` does not stop this — the ROOT
 * is always copied, which is what `isRoot` means in the copier.
 */
export const DUPLICATE_PROJECT = {
  shareTypes: SHARE_TYPES,
  renameField: "title",
} as const;

/**
 * A Service page. Both routing handles are cleared, for the reason a Blog
 * Post's slug is: `slug` IS the URL and nothing enforces uniqueness, so a copy
 * would shadow the original on `/[serviceSlug]`; `key` is the internal handle a
 * route file or the Services menu can hardcode, and a second page answering to
 * it is the same ambiguity one layer down.
 */
export const DUPLICATE_SERVICE_PAGE = {
  shareTypes: SHARE_TYPES,
  clearFields: ["slug", "key"],
  renameField: "title",
} as const;

/**
 * Which lists a Template of each kind carries, and what it creates.
 *
 * One mapping for all three now: `sections` to `sections`. A Project used to be
 * the exception — its content was four owned child lists and it had no
 * `sections` at all, so a project Template had to carry four extra slots that
 * the other two kinds never read. Those lists are sections now (ADR 0022), and
 * the four slots came off the Template Type with them.
 *
 * A Service is still the odd one, in the other direction: what a template
 * creates is a `page`, but a *Service* is a page **plus** a `service-card`
 * linking to it. Only the call site on `/services` knows that, so it creates the
 * card itself after this resolves.
 */
type TemplateKindConfig = Pick<
  CreateFromTemplateOptions,
  "kind" | "targetType" | "targetLabel" | "fieldMap" | "shareTypes"
>;

export const BLOG_TEMPLATE: TemplateKindConfig = {
  kind: "blog",
  targetType: "blog-post",
  targetLabel: "blog post",
  fieldMap: { sections: "sections" },
  shareTypes: SHARE_TYPES,
};

export const SERVICE_TEMPLATE: TemplateKindConfig = {
  kind: "service",
  targetType: "page",
  targetLabel: "service page",
  fieldMap: { sections: "sections" },
  shareTypes: SHARE_TYPES,
};

export const PROJECT_TEMPLATE: TemplateKindConfig = {
  kind: "project",
  targetType: "project",
  targetLabel: "project",
  fieldMap: { sections: "sections" },
  shareTypes: SHARE_TYPES,
};

/**
 * The same mapping read backwards, for "Save as template" — the source is now
 * the real Blog Post / page / Project and the target is the Template. Derived
 * rather than written twice, so the two directions cannot drift.
 */
export function saveAsTemplateOptions(
  config: TemplateKindConfig,
  suggestedName?: string | null,
): SaveAsTemplateOptions {
  return {
    kind: config.kind,
    fieldMap: Object.fromEntries(
      Object.entries(config.fieldMap).map(([from, to]) => [to, from]),
    ),
    shareTypes: config.shareTypes,
    suggestedName: suggestedName?.trim()
      ? `${suggestedName.trim()} template`
      : undefined,
  };
}
