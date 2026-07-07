"use server";

import { revalidatePath } from "next/cache";

/**
 * Invalidate the cached marketing pages after an editor saves a draft or
 * publishes from the zero-cms bar/drawer. Always revalidates now (ADR 0010:
 * production uses ISR, not a static export — a publish's whole point is to
 * update *production's* live cache, not just an editor-facing preview).
 *
 * Pairs with a client-side `router.refresh()` so the editor sees their own
 * change immediately; this clears the shared route cache for everyone else.
 */
export async function revalidateCms(): Promise<void> {
  revalidatePath("/", "layout");
}
