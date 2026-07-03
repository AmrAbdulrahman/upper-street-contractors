"use client";

/**
 * The `blocks`-field editor injected into <CmsApp> / <ZeroCmsWidget> via their
 * `blocks` slot. HugeRTE is heavy and browser-only, so the real editor is loaded
 * with next/dynamic({ ssr: false }) — this thin wrapper keeps `import "hugerte"`
 * out of the server bundle and matches the lib's BlocksComponent signature.
 */

import dynamic from "next/dynamic";
import type { BlocksContent } from "@usc/zero-cms-blocks";

const Impl = dynamic(() => import("./hugerte-blocks-editor-impl"), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-md bg-neutral-100" />,
});

export function HugeRTEBlocksEditor(props: {
  value: BlocksContent;
  onChange: (value: BlocksContent) => void;
}) {
  return <Impl {...props} />;
}
