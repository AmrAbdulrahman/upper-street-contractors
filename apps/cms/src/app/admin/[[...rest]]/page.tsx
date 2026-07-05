"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { CmsApp } from "@usc/zero-cms-app";
import { HugeRTEBlocksEditor } from "@usc/zero-cms-blocks";
import { cmsNotify } from "@/lib/cms/notify";

/**
 * /admin/[[...rest]] — the zero-cms management app, deep-linked + login-gated. The
 * catch-all segments after /admin become the CmsApp `path` (e.g.
 * /admin/entries/project/<id>); navigation pushes them back onto the router.
 *
 * Lives here (cms), not on the website, so production (static export) never
 * ships an editing surface at all — see root README -> Architecture.
 */
export default function AdminPage() {
  const router = useRouter();
  const pathname = usePathname();

  const path = useMemo(
    () =>
      pathname
        .replace(/^\/admin\/?/, "")
        .split("/")
        .filter(Boolean),
    [pathname]
  );

  return (
    <main className="p-4 md:p-8">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">Content admin</h1>
      <CmsApp
        auth={{ baseUrl: "" }}
        blocks={HugeRTEBlocksEditor}
        notify={cmsNotify}
        path={path}
        onNavigate={(p) =>
          router.push("/admin" + (p.length ? "/" + p.join("/") : ""))
        }
      />
      <Toaster position="bottom-center" richColors closeButton />
    </main>
  );
}
