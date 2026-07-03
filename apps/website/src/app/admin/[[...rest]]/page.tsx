"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CmsApp } from "@usc/zero-cms-app";

/**
 * /admin/[[...rest]] — the zero-cms management app, deep-linked + login-gated. The
 * catch-all segments after /admin become the CmsApp `path` (e.g.
 * /admin/entries/project/<id>); navigation pushes them back onto the router. The
 * `auth` gate provides the authed adapter. Lives outside the marketing layout.
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
        path={path}
        onNavigate={(p) =>
          router.push("/admin" + (p.length ? "/" + p.join("/") : ""))
        }
      />
    </main>
  );
}
