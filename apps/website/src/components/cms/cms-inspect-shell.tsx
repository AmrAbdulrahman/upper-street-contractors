import { isPreview } from "@/lib/app-env";
import { CmsInspectShellClient } from "./cms-inspect-shell-client";

/**
 * Mounts the zero-cms editing widget + admin bar, but only on the editor-facing
 * **preview** deploy (`NEXT_PUBLIC_APP_ENV=preview`). On production nothing extra
 * is mounted and pages stay statically prerendered — <ZeroCmsEntry> renders through.
 *
 * Inspect state itself is resolved client-side (from `?inspect=true`) inside the
 * client shell, because a layout Server Component does not re-render on a
 * query-only navigation — so it can't react to the inspect toggle.
 */
export function CmsInspectShell({ children }: { children: React.ReactNode }) {
  if (!isPreview()) {
    return <>{children}</>;
  }

  return <CmsInspectShellClient>{children}</CmsInspectShellClient>;
}
