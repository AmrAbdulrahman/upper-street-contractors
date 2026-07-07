import type { Metadata } from "next";
import { CmsShell } from "./cms-shell";

// The dashboard is always private, regardless of Draft Mode — unlike the rest
// of /admin/*, which mirrors the public (site) routes (see proxy.ts), this
// subtree is real, always noindex.
export const metadata: Metadata = {
  title: "Content admin",
  robots: { index: false, follow: false },
};

export default function AdminCmsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-100">
      <CmsShell>{children}</CmsShell>
    </div>
  );
}
