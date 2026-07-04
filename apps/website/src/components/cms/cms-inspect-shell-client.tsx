'use client';

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Toaster } from "sonner";
import { ZeroCmsBar, ZeroCmsWidget } from "@usc/zero-cms-widget";
import { revalidateCms } from "@/lib/cms/revalidate";
import { cmsNotify } from "@/lib/cms/notify";
import { HugeRTEBlocksEditor } from "@/components/cms/hugerte-blocks-editor";

/**
 * Renders the zero-cms widget + admin bar (preview deploy only).
 *
 * `inspect` is driven by the `?inspect=true` query param read client-side via
 * `useSearchParams()`, so the toggle reacts instantly to client navigation (a
 * layout Server Component can't — it doesn't re-render on a query-only change).
 *
 * The widget provider stays mounted above `children` so they never remount, while
 * the param reader (which needs `useSearchParams`, hence a Suspense boundary) lives
 * in a sibling and lifts the inspect flag up via state. Inspect starts `false`, so
 * SSR + first client render emit plain children — the overlays activate after mount.
 */
export function CmsInspectShellClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [inspect, setInspect] = useState(false);

  // After a draft save (drawer) or publish (bar): clear the shared route cache and
  // refresh so the editor sees their change immediately.
  const onContentChange = useCallback(() => {
    void revalidateCms();
    router.refresh();
  }, [router]);

  return (
    <>
      <ZeroCmsWidget
        inspect={inspect}
        auth={{ baseUrl: process.env.NEXT_PUBLIC_ZERO_CMS_URL ?? "" }}
        blocks={HugeRTEBlocksEditor}
        notify={cmsNotify}
        onSaved={onContentChange}
      >
        <Suspense fallback={null}>
          <InspectControls
            inspect={inspect}
            onInspectChange={setInspect}
            onContentChange={onContentChange}
          />
        </Suspense>
        {children}
      </ZeroCmsWidget>
      <Toaster position="bottom-center" richColors closeButton />
    </>
  );
}

function InspectControls({
  inspect,
  onInspectChange,
  onContentChange,
}: {
  inspect: boolean;
  onInspectChange: (inspect: boolean) => void;
  onContentChange: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const paramInspect = searchParams.get("inspect") === "true";

  useEffect(() => {
    onInspectChange(paramInspect);
  }, [paramInspect, onInspectChange]);

  const toggleInspect = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (paramInspect) params.delete("inspect");
    else params.set("inspect", "true");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <ZeroCmsBar
      inspect={inspect}
      onToggleInspect={toggleInspect}
      onChange={onContentChange}
    />
  );
}
