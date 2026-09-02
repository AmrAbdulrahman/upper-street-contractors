import { CmsInspectShell } from "@/components/cms/cms-inspect-shell";
import { SiteChrome } from "@/components/layout/site-chrome";
import { NotFoundContent } from "@/components/not-found/not-found-content";

/**
 * The 404 for URLs that match no route at all — in practice anything with more
 * than one segment, like `/foo/bar`. Those never enter the `(site)` route
 * group, so they inherit no layout, which is why this file mounts
 * `CmsInspectShell` + `SiteChrome` itself: without them a mistyped URL dropped
 * the visitor onto a bare centred heading with no header, no footer, no
 * navigation and no way to contact anyone — a dead end at exactly the moment
 * someone is already lost.
 *
 * A SINGLE-segment miss does not come here. `/kitchn` matches
 * `(site)/[serviceSlug]` (ADR 0020), so it enters the group and is caught by
 * `(site)/not-found.tsx`, which renders the same body *without* chrome. That
 * split is the fix for a real bug: while this was the only 404, an in-group
 * `notFound()` kept `SiteLayout`'s chrome and got this file's chrome on top of
 * it — two of everything.
 *
 * No `metadata` export — Next only supports one on `global-not-found`, and it
 * already injects `noindex` for anything returning a 404.
 */
export default function NotFound() {
  return (
    <CmsInspectShell>
      <SiteChrome>
        <NotFoundContent />
      </SiteChrome>
    </CmsInspectShell>
  );
}
