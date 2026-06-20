"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { publishEntries } from "@/lib/entry-editor/actions";
import {
  clearChangedEntries,
  removeChangedEntry,
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

      for (const published of result.published) {
        removeChangedEntry({
          typename: published.typename,
          documentId: published.documentId,
        });
      }

      if (result.ok) {
        clearChangedEntries();
        const count = result.published.length;
        toast.success(`Published ${count} change${count === 1 ? "" : "s"}`);
      } else {
        toast.error(
          `Some changes failed to publish: ${result.errors
            .map((entry) => entry.error)
            .join("; ")}`,
        );
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handlePublish}
      disabled={pending}
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[100] inline-flex h-12 -translate-x-1/2 items-center gap-2 rounded-xl bg-whatsapp px-5 text-sm font-semibold text-white shadow-lg transition-[filter,opacity] hover:brightness-110 disabled:opacity-60"
    >
      {pending ? "Publishing…" : `Publish all changes (${entries.length})`}
    </button>
  );
}
