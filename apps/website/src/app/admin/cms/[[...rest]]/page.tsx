"use client";

import { ZeroCmsAdminContent } from "@usc/zero-cms-app";

/**
 * /admin/cms/[[...rest]] — the changing part of the dashboard (entries list +
 * editor, or TypeBuilder / MediaLibrary depending on section). The stable
 * chrome (auth, nav strip, Type sidebar) lives in `../layout.tsx` /
 * `../cms-shell.tsx` — deliberately split so the App Router doesn't tear down
 * and rebuild the whole dashboard (including re-authenticating) on every
 * Type/entry navigation. See `@usc/zero-cms-app`'s `admin-nav.tsx`.
 */
export default function AdminPage() {
  return (
    <>
      
      <ZeroCmsAdminContent />
    </>
    
  );
}
