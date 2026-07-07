/**
 * Shared between `query.ts` (tags every `unstable_cache`'d CMS read) and
 * `zero-cms/server.ts` (calls `revalidateTag` on every publish-affecting op)
 * — kept as one constant so the two can't drift apart.
 */
export const ZERO_CMS_CACHE_TAG = "zero-cms";
