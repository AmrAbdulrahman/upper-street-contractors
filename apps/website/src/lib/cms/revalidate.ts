"use server";

import { revalidatePath } from "next/cache";
import { isPreview } from "@/lib/app-env";

/**
 * Invalidate the cached marketing pages after an editor saves a draft or publishes
 * from the zero-cms bar/drawer. Scoped to preview deploys — production content only
 * changes through a publish + redeploy, so there's nothing to revalidate live.
 *
 * Pairs with a client-side `router.refresh()` so the editor sees their own change
 * immediately; this clears the shared route cache for everyone else.
 */
export async function revalidateCms(): Promise<void> {
  if (!isPreview()) return;
  revalidatePath("/", "layout");
}
