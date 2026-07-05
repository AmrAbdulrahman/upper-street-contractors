import { toast } from "sonner";

/**
 * Host notifier wired into zero-cms's injected `notify` prop (CmsApp →
 * ZeroCmsProvider). Fires a toast for every CMS mutation (save / publish /
 * unpublish / discard / delete / publish-all) success or failure. Client-only:
 * only ever called from event handlers inside the editing UI, so `toast` never
 * runs during SSR. Requires a `<Toaster />` mounted in the same tree (see
 * /admin page).
 */
export function cmsNotify(kind: "success" | "error", message: string) {
  if (kind === "success") toast.success(message);
  else toast.error(message);
}
