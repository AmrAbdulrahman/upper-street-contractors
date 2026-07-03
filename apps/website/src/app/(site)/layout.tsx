import { SiteChrome } from "@/components/layout/site-chrome";
import { CmsInspectShell } from "@/components/cms/cms-inspect-shell";

/**
 * Marketing site layout: the public SiteChrome (header/footer) wrapped in the
 * zero-cms inspect shell. On a preview deploy (`NEXT_PUBLIC_APP_ENV=preview`) the shell mounts
 * the editor bar; the /admin area lives outside this group and renders none of it.
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
