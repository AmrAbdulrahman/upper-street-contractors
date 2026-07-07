/**
 * Query model — a serializable filter DSL (ADR 0004).
 *
 * Must serialize across the http adapter, so filters are plain objects, never
 * JS predicate functions. Maps 1:1 onto a future GraphQL `where` input.
 */

import type { ReadStatus } from './entry';

/** Operators usable against a single field. All optional; AND-combined. */
export interface FieldFilter {
  eq?: unknown;
  ne?: unknown;
  in?: unknown[];
  nin?: unknown[];
  contains?: string;
  gt?: number | string;
  gte?: number | string;
  lt?: number | string;
  lte?: number | string;
  /** Field value is (not) null/undefined. */
  exists?: boolean;
}

/**
 * Where clause: a map of field name → {@link FieldFilter}, AND-combined.
 * Besides user fields, the derived fields `__status` and `hasDraft` are filterable.
 */
export type Where = Record<string, FieldFilter>;

export interface Sort {
  field: string;
  dir: 'asc' | 'desc';
}

export interface Page {
  limit?: number;
  offset?: number;
}

/**
 * Populate paths for reference resolution. Dot-separated, arbitrary depth.
 * e.g. `["author", "relatedProjects.author"]`.
 */
export type Populate = string[];

export interface QueryInput {
  where?: Where;
  sort?: Sort[];
  page?: Page;
  /** Version selector (default `published`). NOT a filter — see ADR 0006. */
  status?: ReadStatus;
  populate?: Populate;
  /**
   * Admin escape hatch: when `true` under `status: 'draft'`, also include
   * unpublished entries that have no draft (normally hidden from preview reads).
   * Used by the management app to list every entry. Default `false`.
   */
  includeUnpublished?: boolean;
}

export interface QueryResult<T> {
  data: T[];
  total: number;
}

export interface GetOptions {
  status?: ReadStatus;
  populate?: Populate;
  /**
   * Admin escape hatch (mirrors {@link QueryInput.includeUnpublished}): when `true`
   * under `status: 'draft'`, return the entry even if it is unpublished with no
   * draft (normally hidden from preview reads). Default `false`.
   */
  includeUnpublished?: boolean;
}
