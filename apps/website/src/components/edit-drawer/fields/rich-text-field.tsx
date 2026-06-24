"use client";

// Self-hosted / bundled HugeRTE — these side-effect imports register the editor
// and its assets onto window.hugerte, which @hugerte/hugerte-react auto-detects
// (no CDN). This whole module is dynamically imported (ssr:false) so it loads
// only when a richtext field is actually edited.
import "hugerte";
import "hugerte/models/dom";
import "hugerte/themes/silver";
import "hugerte/icons/default";
import "hugerte/plugins/lists";
import "hugerte/plugins/link";

import { Editor } from "@hugerte/hugerte-react";
import type { Editor as HugeRTEEditor } from "hugerte";
import { useMemo } from "react";
import { Controller, type Control } from "react-hook-form";
import { blocksToHtml, htmlToBlocks } from "@/lib/entry-editor/blocks-html";
import type { EntryFieldDescriptor } from "@/lib/entry-editor/types";
import type { FormValues } from "../ui";

// Locked to exactly what rich-text.tsx renders: Text/H1-3, bold, italic,
// strikethrough, inline code, bullet/numbered list, link.
const TOOLBAR = "blocks | bold italic strikethrough inlinecode | bullist numlist | link";

const INIT = {
  menubar: false,
  statusbar: false,
  branding: false,
  height: 320,
  plugins: "lists link",
  toolbar: TOOLBAR,
  block_formats: "Paragraph=p;Heading 1=h1;Heading 2=h2;Heading 3=h3",
  // Skins are served from /public (copied by scripts/copy-hugerte-skins.mjs) and
  // loaded by URL — avoids HugeRTE fetching them under the Turbopack chunk path
  // (which 404s). skin_url covers the toolbar + iframe content skin.
  skin_url: "/hugerte/skins/ui/oxide",
  content_css: "/hugerte/skins/content/default/content.min.css",
  formats: { inlinecode: { inline: "code" } },
  setup: (editor: HugeRTEEditor) => {
    editor.ui.registry.addToggleButton("inlinecode", {
      text: "</>",
      tooltip: "Inline code",
      onAction: () => editor.execCommand("mceToggleFormat", false, "inlinecode"),
      onSetup: (api) => {
        const binding = editor.formatter.formatChanged("inlinecode", (state) =>
          api.setActive(state),
        );
        return () => binding.unbind();
      },
    });
  },
};

function RichTextEditor({
  value,
  defaultValue,
  onChange,
}: {
  value: string;
  defaultValue: string;
  onChange: (html: string) => void;
}) {
  const dropped = useMemo(() => {
    try {
      return [...new Set(htmlToBlocks(value || "").dropped)];
    } catch {
      return [];
    }
  }, [value]);

  // Only flag once the field is actually edited — pre-existing unsupported
  // content in an untouched field is never written, so it shouldn't alarm.
  const changed = useMemo(() => {
    try {
      return (
        JSON.stringify(htmlToBlocks(value || "").blocks) !==
        JSON.stringify(htmlToBlocks(defaultValue || "").blocks)
      );
    } catch {
      return false;
    }
  }, [value, defaultValue]);

  return (
    <div>
      <Editor value={value} onEditorChange={(html) => onChange(html)} init={INIT} />
      {changed && dropped.length > 0 ? (
        <p
          role="alert"
          className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          Unsupported content ({dropped.join(", ")}) will be removed — remove it or
          edit in the CMS to save.
        </p>
      ) : null}
    </div>
  );
}

export default function RichTextField({
  field,
  control,
}: {
  field: EntryFieldDescriptor;
  control: Control<FormValues>;
}) {
  const defaultValue = blocksToHtml(field.value);
  return (
    <Controller
      control={control}
      name={field.name}
      render={({ field: f }) => (
        <RichTextEditor
          value={(f.value as string) ?? ""}
          defaultValue={defaultValue}
          onChange={f.onChange}
        />
      )}
    />
  );
}
