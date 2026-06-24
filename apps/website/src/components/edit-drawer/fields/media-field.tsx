"use client";

import { useState, useTransition } from "react";
import { Controller, type Control } from "react-hook-form";
import { listMediaFiles } from "@/lib/entry-editor/actions";
import type { EntryFieldDescriptor, MediaFileRef } from "@/lib/entry-editor/types";
import { useStrapiInspection } from "@/components/strapi/strapi-inspection-provider";
import { FIELD_INPUT_CLASS, humanizeFieldName, type FormValues } from "../ui";

function absoluteUrl(strapiUrl: string, url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${strapiUrl.replace(/\/$/, "")}${url}`;
}

function isImage(file: { mime?: string }): boolean {
  return Boolean(file.mime?.startsWith("image/"));
}

export function MediaField({
  field,
  control,
  autoFocus,
}: {
  field: EntryFieldDescriptor;
  control: Control<FormValues>;
  autoFocus?: boolean;
}) {
  const { strapiUrl } = useStrapiInspection();
  const label = humanizeFieldName(field.name);

  const uploadHref = `${strapiUrl.replace(/\/$/, "")}/admin/plugins/upload?sort=createdAt:DESC&page=1&pageSize=10`;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<MediaFileRef[]>([]);
  const [loading, startLoad] = useTransition();

  const loadFiles = (term: string) =>
    startLoad(async () => {
      setFiles(await listMediaFiles(term));
    });

  const openPicker = () => {
    setPickerOpen(true);
    loadFiles("");
  };

  return (
    <Controller
      control={control}
      name={field.name}
      render={({ field: f }) => {
        const current = (f.value as MediaFileRef | null) ?? null;

        const choose = (file: MediaFileRef) => {
          f.onChange(file);
          setPickerOpen(false);
        };

        return (
          <div className="space-y-3">
            {current ? (
              <div className="flex items-center gap-3">
                {isImage(current) ? (
                  // Strapi media host isn't in next.config images; raw <img> preview.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={absoluteUrl(strapiUrl, current.url)}
                    alt={current.name}
                    className="h-16 w-16 shrink-0 rounded-md border border-border object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-[11px] text-subtle">
                    file
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {current.name}
                </span>
                <button
                  type="button"
                  onClick={() => f.onChange(null)}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface"
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className="text-sm text-subtle">No image selected.</p>
            )}

            <button
              type="button"
              onClick={openPicker}
              autoFocus={autoFocus}
              aria-label={`Choose ${label} from media library`}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Choose from library
            </button>

            {pickerOpen ? (
              <div className="space-y-2 rounded-md border border-border p-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      loadFiles(event.target.value);
                    }}
                    placeholder="Search files…"
                    aria-label="Search media files"
                    className={FIELD_INPUT_CLASS}
                  />
                  <a
                    href={uploadHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-surface"
                  >
                    Add new Image
                  </a>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(false)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-surface"
                  >
                    Close
                  </button>
                </div>

                {loading ? (
                  <p className="py-4 text-center text-sm text-subtle">Loading…</p>
                ) : files.length === 0 ? (
                  <p className="py-4 text-center text-sm text-subtle">
                    No files found.
                  </p>
                ) : (
                  <ul className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
                    {files.map((file) => (
                      <li key={file.id}>
                        <button
                          type="button"
                          onClick={() => choose(file)}
                          title={file.name}
                          className={`block w-full overflow-hidden rounded-md border transition-colors hover:border-gold ${
                            current?.id === file.id
                              ? "border-gold ring-2 ring-gold/30"
                              : "border-border"
                          }`}
                        >
                          {isImage(file) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={absoluteUrl(strapiUrl, file.url)}
                              alt={file.name}
                              className="aspect-square w-full object-cover"
                            />
                          ) : (
                            <span className="flex aspect-square w-full items-center justify-center bg-surface text-[11px] text-subtle">
                              file
                            </span>
                          )}
                          <span className="block truncate px-1 py-0.5 text-[10px] text-muted">
                            {file.name}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        );
      }}
    />
  );
}
