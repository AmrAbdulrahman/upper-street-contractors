import type { Field, Type, OutputEntry } from '@usc/zero-cms-core';
import { ZeroCmsError } from '@usc/zero-cms-core';
import type { FormValues } from './fields';

export function errorMessage(err: unknown): string {
  if (err instanceof ZeroCmsError) {
    const detail =
      Array.isArray(err.details) && err.details.length
        ? ` (${err.details.length} issue(s))`
        : '';
    return `${err.message}${detail}`;
  }
  return (err as Error)?.message ?? 'Something went wrong';
}

function emptyValue(field: Field): unknown {
  switch (field.__type) {
    case 'boolean':
      return false;
    case 'references':
    case 'blocks':
      return [];
    default:
      return ''; // text/number/json/asset/lookup/reference — stripped on submit if blank
  }
}

/**
 * Drop empty-string values before saving: a blank optional select/input means
 * "unset", not a literal "". Keeps booleans, arrays, and non-empty values.
 * (Empty required fields are caught by core on publish.)
 */
export function cleanValues(values: FormValues): FormValues {
  const out: FormValues = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === '') continue;
    out[k] = v;
  }
  return out;
}

/** Build RHF default values for a Type from an (optional) entry. */
export function defaultsFor(type: Type, entry?: OutputEntry | null): FormValues {
  const out: FormValues = {};
  for (const f of type.fields) {
    const v = entry ? entry[f.__name] : undefined;
    out[f.__name] = v ?? emptyValue(f);
  }
  return out;
}

/**
 * Dependency-free fuzzy filter: true when every character of `query` appears
 * in `text`, in order (case-insensitive), not necessarily contiguous — the
 * same basic match a command palette uses. An empty query matches everything.
 */
export function fuzzyMatch(query: string, text: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/**
 * Treat ''/null/undefined as the same "unset" value — mirrors `cleanValues`
 * (a blank field means unset, not a literal empty string) so the published-
 * value diff doesn't flag a field as "changed" over that distinction alone.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === '' || v == null ? null : v);
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  return JSON.stringify(na) === JSON.stringify(nb);
}

/** Short, readable preview of a field's value for the published-value diff note. */
export function formatFieldValue(field: Field, value: unknown): string {
  if (value === '' || value == null) return '(empty)';
  switch (field.__type) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'references':
      return Array.isArray(value) && value.length
        ? `${value.length} linked ${value.length === 1 ? 'entry' : 'entries'}`
        : '(empty)';
    case 'reference':
      return typeof value === 'string' ? value : '(empty)';
    case 'blocks':
      return Array.isArray(value) && value.length ? 'Rich content' : '(empty)';
    case 'json':
      return truncate(JSON.stringify(value), 140);
    default:
      return truncate(String(value), 140);
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
