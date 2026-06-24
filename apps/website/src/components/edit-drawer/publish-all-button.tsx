"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { publishEntries } from "@/lib/entry-editor/actions";
import {
  refreshChangedEntries,
  useChangedEntries,
} from "./changed-entries-store";

export function PublishAllButton() {
  const entries = useChangedEntries();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (entries.length === 0) return null;

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

  const label = pending
    ? "Publishing…"
    : `Publish (${entries.length}) changes`;

  const className = "inline-flex h-7 items-center rounded-md bg-whatsapp px-3 text-xs font-semibold text-white transition-[filter,opacity] hover:brightness-110 disabled:opacity-60";

  return (
    <button
      type="button"
      onClick={handlePublish}
      disabled={pending}
      aria-live="polite"
      className={className}
    >
      {label}
    </button>
  );
}
