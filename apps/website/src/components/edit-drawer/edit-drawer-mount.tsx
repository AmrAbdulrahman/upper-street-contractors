"use client";

import dynamic from "next/dynamic";
import { Toaster } from "sonner";
import { useEditDrawerTarget } from "./edit-drawer-store";
import { PublishAllButton } from "./publish-all-button";

// Heavy drawer (+ HugeRTE) loads only once something opens it.
const EditDrawer = dynamic(() => import("./edit-drawer"), { ssr: false });

/**
 * Single leaf client component mounted once in site-chrome (inspection builds
 * only). It is NOT a provider — it doesn't wrap the app tree — so SSR of the
 * page content is preserved.
 */
export function EditDrawerMount() {
  const target = useEditDrawerTarget();

  return (
    <>
      {target !== null ? <EditDrawer /> : null}
      <PublishAllButton />
      <Toaster position="bottom-right" richColors />
    </>
  );
}
