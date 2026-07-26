'use client';

/**
 * Whether THIS component may render its inspect-mode affordances yet.
 *
 * Every inspect wrapper has to ask through here rather than reading
 * `widget.inspect` directly, because that flag alone causes hydration mismatches.
 *
 * `WidgetProvider` already gates it on a mount effect so SSR and the first client
 * render agree — but the provider sits above `SiteChrome`, Next's `LoadingBoundary`
 * and other Suspense boundaries. It commits and flips the flag **before** those
 * deeper boundaries have hydrated, so a wrapper inside them hydrates with inspect
 * already true and emits markup the server never sent:
 *
 *     +  <div className="… relative outline outline-2 …">   (client)
 *     -  <div className="flex min-w-0 flex-col gap-8">      (server)
 *
 * and worse, where `wrapWithInspect` falls back to `InspectHost`, an `<h1>` is
 * replaced by a wrapping `<div>` — a structural change, not just a className.
 *
 * The local effect below can only run after this component's own hydration, so its
 * first render always matches whatever the server sent, whenever that happens. It
 * has to be per-component: one shared flag higher up is exactly what doesn't work.
 */

import { useEffect, useState } from 'react';
import { useZeroCmsWidgetOptional } from '../context';

export function useInspect(): boolean {
  const widget = useZeroCmsWidgetOptional();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return Boolean(widget?.inspect && mounted);
}
