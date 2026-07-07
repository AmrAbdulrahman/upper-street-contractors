'use client';

/**
 * The `blocks`-field editor injected into <CmsApp> / <ZeroCmsWidget> via their
 * `blocks` slot. HugeRTE is heavy and browser-only, so the real editor is loaded
 * with next/dynamic({ ssr: false }) — this thin wrapper keeps `import "hugerte"`
 * out of the server bundle and matches the lib's BlocksComponent signature.
 *
 * Used by both the Inspect-mode overlay and the /admin/cms dashboard — one app
 * (website) now hosts both, so the HugeRTE skin assets just live once at
 * apps/website/public/hugerte (no more per-app symlink now that cms merged in).
 */

import dynamic from 'next/dynamic';
import type { BlocksContent } from './types';

const Impl = dynamic(() => import('./hugerte-editor-impl'), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-md bg-neutral-100" />,
});

export function HugeRTEBlocksEditor(props: {
  value: BlocksContent;
  onChange: (value: BlocksContent) => void;
}) {
  return <Impl {...props} />;
}
