/** Typed errors so callers (and the app UI) can branch on `code`. */

export type ZeroCmsErrorCode =
  | 'NOT_FOUND'
  | 'TYPE_NOT_FOUND'
  | 'VALIDATION'
  | 'REFERENCE_INTEGRITY'
  | 'DESTRUCTIVE_SCHEMA_EDIT'
  | 'MEDIA_IN_USE'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN';

export class ZeroCmsError extends Error {
  readonly code: ZeroCmsErrorCode;
  readonly details?: unknown;
  constructor(code: ZeroCmsErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ZeroCmsError';
    this.code = code;
    this.details = details;
  }
}

/** A single reference holding an entry, for integrity error payloads. */
export interface ReferenceHit {
  /** Entry id that holds the reference. */
  fromId: string;
  fromType: string;
  field: string;
  /** Whether the hit is in the live values or the pending draft. */
  in: 'values' | 'draft';
}
