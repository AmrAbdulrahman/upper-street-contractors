"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { ZeroCmsAdminLayout } from "@usc/zero-cms-app";
import { HugeRTEBlocksEditor } from "@usc/zero-cms-blocks";
import { cmsNotify } from "@/lib/cms/notify";

/**
 * The stable part of /admin/cms, rendered from `layout.tsx` — auth, the
 * schema/media provider, the nav strip and Type sidebar. Living in a Next
 * layout (not the page) is the whole point: Next only guarantees a component
 * survives navigation between nested segments when it's part of the layout,
 * not the page itself. Previously this all lived in `page.tsx` alongside the
 * changing content, so the App Router tore down and rebuilt the entire tree
 * (including `<AuthGate>` — a fresh login-loading flash and full schema/media
 * re-fetch) on every Type switch. See `@usc/zero-cms-app`'s `admin-nav.tsx`.
 *
 * `path`/`onNavigate` bridge the catch-all segments after /admin/cms to
 * CmsApp's router-independent path model.
 */
export function CmsShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const path = useMemo(
    () =>
      pathname
        .replace(/^\/admin\/cms\/?/, "")
        .split("/")
        .filter(Boolean),
    [pathname]
  );

  return (
    <main className="flex min-h-0 flex-1 flex-col p-4 md:p-8">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-neutral-900">Content admin</h1>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          <span aria-hidden="true">&larr;</span>
          Back to admin
        </Link>
      </div>
      <ZeroCmsAdminLayout
        auth={{ baseUrl: "" }}
        blocks={HugeRTEBlocksEditor}
        notify={cmsNotify}
        path={path}
        onNavigate={(p) => router.push("/admin/cms" + (p.length ? "/" + p.join("/") : ""))}
        className="min-h-0 flex-1"
      >
        {children}
      </ZeroCmsAdminLayout>
      <Toaster position="bottom-center" richColors closeButton />
    </main>
  );
}
