/**
 * Strapi → zero-cms schema migration (node). Converts Strapi content-type
 * `schema.json` files into a zero-cms {@link Schema}.
 *
 * Mapping:
 *   string/uid/email/date/...  -> text          text -> longtext
 *   richtext -> richtext        blocks -> blocks
 *   integer/biginteger -> number(integer)        decimal/float -> number
 *   boolean -> boolean          json -> json     enumeration -> lookup(options)
 *   media (single) -> asset(accept)              media (multiple) -> asset + warning
 *   relation one/manyToOne -> reference          one/manyToMany -> references
 *   component / dynamiczone -> skipped (+warning)
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Field, Schema, Type } from '../model/schema';

export interface StrapiAttribute {
  type: string;
  required?: boolean;
  enum?: string[];
  allowedTypes?: string[];
  multiple?: boolean;
  relation?: string;
  target?: string;
  [k: string]: unknown;
}

export interface StrapiContentType {
  info: { singularName: string; pluralName?: string; displayName?: string };
  attributes: Record<string, StrapiAttribute>;
}

export interface MigrationResult {
  schema: Schema;
  warnings: string[];
}

/** `api::project-card.project-card` -> `project-card`. */
function targetSingular(target: string): string {
  const tail = target.split('.').pop() ?? target;
  return tail.replace(/^api::/, '');
}

function mediaAccept(allowed?: string[]): 'image' | 'video' | 'any' {
  if (!allowed || allowed.length === 0) return 'any';
  const set = new Set(allowed);
  const onlyImages = set.has('images') && !set.has('videos') && !set.has('files');
  const onlyVideos = set.has('videos') && !set.has('images') && !set.has('files');
  return onlyImages ? 'image' : onlyVideos ? 'video' : 'any';
}

function mapAttribute(
  name: string,
  attr: StrapiAttribute,
  resolveTarget: (uid: string) => string,
  warnings: string[],
  typeName: string
): Field | null {
  const required = attr.required === true ? { required: true } : {};
  const base = { __name: name, ...required };

  switch (attr.type) {
    case 'string':
    case 'uid':
    case 'email':
    case 'password':
    case 'date':
    case 'datetime':
    case 'time':
      return { ...base, __type: 'text' };
    case 'text':
      return { ...base, __type: 'longtext' };
    case 'richtext':
      return { ...base, __type: 'richtext' };
    case 'blocks':
      return { ...base, __type: 'blocks' };
    case 'integer':
    case 'biginteger':
      return { ...base, __type: 'number', integer: true };
    case 'decimal':
    case 'float':
      return { ...base, __type: 'number' };
    case 'boolean':
      return { ...base, __type: 'boolean' };
    case 'json':
      return { ...base, __type: 'json' };
    case 'enumeration':
      return { ...base, __type: 'lookup', options: attr.enum ?? [] };
    case 'media': {
      if (attr.multiple)
        warnings.push(
          `${typeName}.${name}: multiple media -> single asset (cardinality lost)`
        );
      return { ...base, __type: 'asset', accept: mediaAccept(attr.allowedTypes) };
    }
    case 'relation': {
      const target = attr.target ? resolveTarget(attr.target) : '';
      const many =
        attr.relation === 'oneToMany' || attr.relation === 'manyToMany';
      const allowedTypes = target ? [target] : [];
      return many
        ? { ...base, __type: 'references', allowedTypes }
        : { ...base, __type: 'reference', allowedTypes };
    }
    case 'component':
    case 'dynamiczone':
      warnings.push(`${typeName}.${name}: ${attr.type} not supported — skipped`);
      return null;
    default:
      warnings.push(`${typeName}.${name}: unknown type "${attr.type}" -> text`);
      return { ...base, __type: 'text' };
  }
}

/** Pure conversion of parsed Strapi content-types into a zero-cms Schema. */
export function migrateStrapiSchemas(
  contentTypes: StrapiContentType[]
): MigrationResult {
  const warnings: string[] = [];
  const bySingular = new Map(contentTypes.map((c) => [c.info.singularName, c]));
  const resolveTarget = (uid: string): string => {
    const singular = targetSingular(uid);
    if (bySingular.has(singular)) return singular;
    warnings.push(`unresolved relation target "${uid}"`);
    return singular;
  };

  const schema: Schema = contentTypes.map((ct): Type => {
    const fields = Object.entries(ct.attributes)
      .map(([name, attr]) =>
        mapAttribute(name, attr, resolveTarget, warnings, ct.info.singularName)
      )
      .filter((f): f is Field => f !== null);
    return {
      __name: ct.info.singularName,
      label: ct.info.displayName ?? ct.info.singularName,
      fields,
    };
  });

  return { schema, warnings };
}

/** Read Strapi content-type schemas from a `src/api` directory and convert them. */
export async function strapiSchemaToZeroCms(
  apiDir: string
): Promise<MigrationResult> {
  const entries = await readdir(apiDir, { recursive: true });
  const files = entries
    .map((e) => e.split(/[\\/]/).join('/'))
    .filter((e) => e.includes('content-types/') && e.endsWith('/schema.json'));

  const contentTypes: StrapiContentType[] = [];
  for (const rel of files) {
    try {
      const parsed = JSON.parse(await readFile(join(apiDir, rel), 'utf8'));
      if (parsed?.info?.singularName && parsed?.attributes)
        contentTypes.push(parsed as StrapiContentType);
    } catch {
      /* skip unreadable */
    }
  }
  contentTypes.sort((a, b) =>
    a.info.singularName.localeCompare(b.info.singularName)
  );
  return migrateStrapiSchemas(contentTypes);
}
