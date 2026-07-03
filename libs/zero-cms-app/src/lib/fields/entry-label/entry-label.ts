import type { Type, OutputEntry } from '@usc/zero-cms-core';

/** First text-ish field of a Type, used to label entries in pickers/lists. */
export function titleField(type: Type): string | undefined {
  return type.fields.find((f) => ['text', 'longtext'].includes(f.__type))?.__name;
}

export function entryLabel(type: Type | undefined, entry: OutputEntry): string {
  const tf = type && titleField(type);
  const v = tf ? entry[tf] : undefined;
  return typeof v === 'string' && v ? v : entry.__id.slice(0, 8);
}
