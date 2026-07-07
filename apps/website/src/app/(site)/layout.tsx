import { SiteChrome } from "@/components/layout/site-chrome";
import { CmsInspectShell } from "@/components/cms/cms-inspect-shell";

/**
 * Marketing site layout: the public SiteChrome (header/footer) wrapped in the
 * zero-cms inspect shell. In Draft Mode the shell mounts the editor bar — which
 * includes every visit under `/admin/*` (except `/admin/cms`, the dashboard
 * app), since proxy.ts rewrites those straight to these same (site) pages
 * rather than routing around them.
 */
export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <CmsInspectShell>
      <SiteChrome>{children}</SiteChrome>
    </CmsInspectShell>
  );
}
