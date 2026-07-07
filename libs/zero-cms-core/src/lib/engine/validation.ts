/** Value validation against a Type's fields. */

import type { Type } from '../model/schema';
import type { EntryValues } from '../model/entry';
import { ZeroCmsError } from '../model/errors';

export interface ValidationIssue {
  field: string;
  message: string;
}

/**
 * Validate a values bag against a Type.
 * @param forPublish when true, enforces `required` (live values must be complete);
 *   draft writes pass `false` and may be partial.
 */
export function validateValues(
  type: Type,
  values: EntryValues,
  forPublish: boolean
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const known = new Set(type.fields.map((f) => f.__name));

  for (const key of Object.keys(values)) {
    if (!known.has(key)) issues.push({ field: key, message: 'Unknown field' });
  }

  for (const f of type.fields) {
    const v = values[f.__name];
    const present = v !== null && v !== undefined;

    if (!present) {
      if (forPublish && f.required)
        issues.push({ field: f.__name, message: 'Required' });
      continue;
    }

    switch (f.__type) {
      case 'text':
      case 'longtext':
      case 'richtext':
        if (typeof v !== 'string')
          issues.push({ field: f.__name, message: 'Expected string' });
        break;
      case 'boolean':
        if (typeof v !== 'boolean')
          issues.push({ field: f.__name, message: 'Expected boolean' });
        break;
      case 'date':
        if (
          typeof v !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          Number.isNaN(Date.parse(v))
        )
          issues.push({ field: f.__name, message: 'Expected date (YYYY-MM-DD)' });
        break;
      case 'number':
        if (typeof v !== 'number' || Number.isNaN(v))
          issues.push({ field: f.__name, message: 'Expected number' });
        else {
          if (f.integer && !Number.isInteger(v))
            issues.push({ field: f.__name, message: 'Expected integer' });
          if (f.min !== undefined && v < f.min)
            issues.push({ field: f.__name, message: `Below min ${f.min}` });
          if (f.max !== undefined && v > f.max)
            issues.push({ field: f.__name, message: `Above max ${f.max}` });
        }
        break;
      case 'blocks':
        if (!Array.isArray(v))
          issues.push({ field: f.__name, message: 'Expected blocks array' });
        break;
      case 'json':
        // Any JSON-serialisable value is accepted (presence already checked).
        break;
      case 'asset':
        if (typeof v !== 'string')
          issues.push({ field: f.__name, message: 'Expected media id' });
        break;
      case 'lookup':
        if (typeof v !== 'string' || !f.options.includes(v))
          issues.push({ field: f.__name, message: 'Not an allowed option' });
        break;
      case 'reference':
        if (typeof v !== 'string')
          issues.push({ field: f.__name, message: 'Expected entry id' });
        break;
      case 'references':
        if (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))
          issues.push({ field: f.__name, message: 'Expected array of entry ids' });
        break;
    }
  }
  return issues;
}

export function assertValid(
  type: Type,
  values: EntryValues,
  forPublish: boolean
): void {
  const issues = validateValues(type, values, forPublish);
  if (issues.length)
    throw new ZeroCmsError('VALIDATION', `Invalid values for "${type.__name}"`, issues);
}
