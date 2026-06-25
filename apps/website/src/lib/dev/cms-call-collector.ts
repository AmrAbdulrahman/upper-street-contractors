/**
 * Dev-only in-memory log of Strapi CMS calls.
 *
 * Server-side singleton pinned on `globalThis` so it survives HMR module reloads
 * and any module-graph duplication under `next dev` (RSC, server actions and the
 * /api/dev/cms-calls route handler all share one instance in the single dev
 * process). No-ops outside development, so production builds carry no state and
 * the recording call sites dead-code-eliminate. The client reads this via the
 * dev route — it never imports this module.
 */

const isDev = process.env.NODE_ENV === 'development';

/** Max calls retained in the ring buffer (running `total` is unbounded). */
const CAP = 2000;

export type CmsCallKind = 'graphql' | 'rest';

export type CmsCall = {
  id: number;
  ts: number;
  kind: CmsCallKind;
  /** GraphQL operation name — the "which part called the CMS" attribution. */
  op?: string;
  /** HTTP method (rest). */
  method?: string;
  /** Request path (rest), e.g. /api/projects/abc123. */
  path?: string;
  /** DRAFT | PUBLISHED (graphql) or the HTTP status code (rest). */
  status?: string;
  /** true = real HTTP hit to Strapi; false = served from Next `unstable_cache`. */
  network: boolean;
  ok: boolean;
  durationMs: number;
};

type Store = {
  buf: CmsCall[];
  seq: number;
  total: number;
  bootTs: number;
};

const g = globalThis as unknown as { __USC_CMS_CALLS__?: Store };

function store(): Store {
  if (!g.__USC_CMS_CALLS__) {
    g.__USC_CMS_CALLS__ = { buf: [], seq: 0, total: 0, bootTs: Date.now() };
  }
  return g.__USC_CMS_CALLS__;
}

export function recordCmsCall(entry: Omit<CmsCall, 'id' | 'ts'>): void {
  if (!isDev) return;
  const s = store();
  s.buf.push({ ...entry, id: ++s.seq, ts: Date.now() });
  s.total += 1;
  if (s.buf.length > CAP) s.buf.splice(0, s.buf.length - CAP);
}

export function getCmsCalls(sinceId = 0): {
  entries: CmsCall[];
  total: number;
  bootTs: number;
} {
  const s = store();
  return {
    entries: sinceId > 0 ? s.buf.filter((c) => c.id > sinceId) : s.buf.slice(),
    total: s.total,
    bootTs: s.bootTs,
  };
}
