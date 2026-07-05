'use client';

/**
 * The `blocks`-field editor injected into <CmsApp> / <ZeroCmsWidget> via their
 * `blocks` slot. HugeRTE is heavy and browser-only, so the real editor is loaded
 * with next/dynamic({ ssr: false }) — this thin wrapper keeps `import "hugerte"`
 * out of the server bundle and matches the lib's BlocksComponent signature.
 *
 * Shared between apps/website (Inspect-mode overlay) and apps/cms-app (admin
 * dashboard) — both host it, so it lives here rather than duplicated per app.
 * Each host app must serve the same HugeRTE skin assets at `/hugerte/...` in its
 * own `public/` (Next serves public/ per-app-root); apps/cms-app symlinks
 * apps/website/public/hugerte so there's one source of truth for the assets too.
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
