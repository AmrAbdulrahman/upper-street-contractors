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
