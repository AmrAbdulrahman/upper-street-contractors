import { isPreview } from "@/lib/app-env";
import { CmsInspectShellClient } from "./cms-inspect-shell-client";

/**
 * Mounts the zero-cms editing widget + admin bar, but only when the current
 * request is in Draft Mode (reached via /admin/* — see proxy.ts). Outside of
 * that, nothing extra is mounted and pages render as plain published content.
 *
 * Inspect state itself is resolved client-side (from `?inspect=true`) inside the
 * client shell, because a layout Server Component does not re-render on a
 * query-only navigation — so it can't react to the inspect toggle.
 */
export async function CmsInspectShell({ children }: { children: React.ReactNode }) {
  if (!(await isPreview())) {
    return <>{children}</>;
  }

  return <CmsInspectShellClient>{children}</CmsInspectShellClient>;
}
