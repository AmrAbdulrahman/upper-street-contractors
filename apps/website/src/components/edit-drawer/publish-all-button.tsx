"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { publishEntries } from "@/lib/entry-editor/actions";
import {
  refreshChangedEntries,
  useChangedEntriesState,
} from "./changed-entries-store";

const CLASS_NAME =
  "inline-flex h-7 items-center rounded-md bg-whatsapp px-3 text-xs font-semibold text-white transition-[filter,opacity] hover:brightness-110 disabled:opacity-60";

export function PublishAllButton() {
  const { entries, loaded } = useChangedEntriesState();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Still fetching the draft/published status from Strapi.
  if (!loaded) {
    return (
      <button type="button" disabled aria-busy="true" className={CLASS_NAME}>
        Checking…
      </button>
    );
  }

  // Nothing to publish — drafts all match production.
  if (entries.length === 0) {
    return (
      <button type="button" disabled className={CLASS_NAME}>
        All content matching production
      </button>
    );
  }

  const handlePublish = () => {
    startTransition(async () => {
      const result = await publishEntries(
        entries.map((entry) => ({
          typename: entry.typename,
          documentId: entry.documentId,
        })),
      );

      if (result.ok) {
        const count = result.published.length;
        toast.success(`Published ${count} change${count === 1 ? "" : "s"}`);
      } else {
        toast.error(
          `Some changes failed to publish: ${result.errors
            .map((entry) => entry.error)
            .join("; ")}`,
        );
      }
      refreshChangedEntries();
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handlePublish}
      disabled={pending}
      aria-live="polite"
      className={CLASS_NAME}
    >
      {pending ? "Publishing…" : `Publish (${entries.length}) changes`}
    </button>
  );
}
