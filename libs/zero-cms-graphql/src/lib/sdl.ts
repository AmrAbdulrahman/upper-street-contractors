/**
 * SDL generation (ADR 0005): turn a CMS Schema into GraphQL type definitions.
 * Object types expose `id/type/status/hasDraft` (mapped from `__id/__type/...`)
 * plus the Type's fields. References become object/union types, lookups become
 * enums (when their options are valid GraphQL names), and each Type gets a
 * `Where` input, a `Page` type, an `Input` type, Query and Mutation fields.
 */

import type { Field, Schema, Type } from '@usc/zero-cms-core';
import {
  lookupCanEnum,
  lookupEnumName,
  plural,
  refUnionName,
  typeName,
} from './naming';

const PRELUDE = `scalar JSON

enum CmsStatus { published unpublished }
enum CmsReadStatus { published draft }
enum SortDir { asc desc }

"""A media library item that an asset field points at."""
type Media { id: ID!, url: String!, alt: String, mime: String!, kind: String!, width: Int, height: Int }

input Pagination { limit: Int, offset: Int }
input SortInput { field: String!, dir: SortDir = asc }
input StringFilter { eq: String, ne: String, in: [String!], nin: [String!], contains: String, gt: String, gte: String, lt: String, lte: String, exists: Boolean }
input BooleanFilter { eq: Boolean, ne: Boolean, exists: Boolean }
input NumberFilter { eq: Float, ne: Float, in: [Float!], nin: [Float!], gt: Float, gte: Float, lt: Float, lte: Float, exists: Boolean }`;

function outputType(type: Type, field: Field): string {
  switch (field.__type) {
    case 'text':
    case 'longtext':
    case 'richtext':
    case 'date':
      return 'String';
    case 'asset':
      return 'Media';
    case 'number':
      return field.integer ? 'Int' : 'Float';
    case 'blocks':
    case 'json':
      return 'JSON';
    case 'boolean':
      return 'Boolean';
    case 'lookup':
      return lookupCanEnum(field.options)
        ? lookupEnumName(type.__name, field.__name)
        : 'String';
    case 'reference':
      return refTarget(type, field);
    case 'references':
      return `[${refTarget(type, field)}!]`;
  }
}

function refTarget(type: Type, field: Field): string {
  const allowed =
    field.__type === 'reference' || field.__type === 'references'
      ? field.allowedTypes
      : [];
  if (allowed.length === 0) return 'String';
  if (allowed.length === 1) return typeName(allowed[0]);
  return refUnionName(type.__name, field.__name);
}

function inputType(field: Field): string {
  switch (field.__type) {
    case 'boolean':
      return 'Boolean';
    case 'number':
      return field.integer ? 'Int' : 'Float';
    case 'blocks':
    case 'json':
      return 'JSON';
    case 'asset':
      return 'ID';
    case 'lookup':
      return lookupCanEnum(field.options)
        ? lookupEnumName('', field.__name) // placeholder; replaced below
        : 'String';
    case 'reference':
      return 'ID';
    case 'references':
      return '[ID!]';
    case 'date':
      return 'String';
    default:
      return 'String';
  }
}

function whereFilter(field: Field): string | null {
  switch (field.__type) {
    case 'boolean':
      return 'BooleanFilter';
    case 'number':
      return 'NumberFilter';
    case 'text':
    case 'longtext':
    case 'richtext':
    case 'asset':
    case 'lookup':
    case 'date':
      return 'StringFilter';
    default:
      return null; // references, blocks and json are not filterable in v1
  }
}

export function generateSdl(schema: Schema): string {
  const blocks: string[] = [PRELUDE];

  for (const type of schema) {
    const T = typeName(type.__name);

    // Lookup enums
    for (const f of type.fields) {
      if (f.__type === 'lookup' && lookupCanEnum(f.options)) {
        blocks.push(
          `enum ${lookupEnumName(type.__name, f.__name)} { ${f.options.join(' ')} }`
        );
      }
    }
    // Reference unions
    for (const f of type.fields) {
      if (
        (f.__type === 'reference' || f.__type === 'references') &&
        f.allowedTypes.length > 1
      ) {
        blocks.push(
          `union ${refUnionName(type.__name, f.__name)} = ${f.allowedTypes
            .map(typeName)
            .join(' | ')}`
        );
      }
    }

    // Object type
    const objFields = [
      '  id: ID!',
      '  type: String!',
      '  status: CmsStatus!',
      '  hasDraft: Boolean!',
      // The optimistic-concurrency token (ADR 0009) — callers must read this
      // before they can pass `expectedLastEditedAt` to any mutation below.
      '  lastEditedAt: String!',
      ...type.fields.map((f) => `  ${f.__name}: ${outputType(type, f)}`),
    ].join('\n');
    blocks.push(`type ${T} {\n${objFields}\n}`);

    // Filters (Strapi-shaped arg name)
    const filterFields = [
      '  status: StringFilter',
      '  hasDraft: BooleanFilter',
      ...type.fields
        .map((f) => {
          const filter = whereFilter(f);
          return filter ? `  ${f.__name}: ${filter}` : null;
        })
        .filter(Boolean),
    ].join('\n');
    blocks.push(`input ${T}Filters {\n${filterFields}\n}`);

    // Input (all optional; used for create/update/patch)
    const inputFields = type.fields
      .map((f) => {
        const it =
          f.__type === 'lookup' && lookupCanEnum(f.options)
            ? lookupEnumName(type.__name, f.__name)
            : inputType(f);
        return `  ${f.__name}: ${it}`;
      })
      .join('\n');
    blocks.push(`input ${T}Input {\n${inputFields}\n}`);
  }

  // Root Query
  const queryFields = schema
    .map((type) => {
      const T = typeName(type.__name);
      return [
        `  ${camelOf(type)}(id: ID!, status: CmsReadStatus = published): ${T}`,
        `  ${plural(type.__name)}(filters: ${T}Filters, pagination: Pagination, sort: [SortInput!], status: CmsReadStatus = published, includeUnpublished: Boolean): [${T}!]!`,
      ].join('\n');
    })
    .join('\n');
  blocks.push(`type Query {\n${queryFields}\n}`);

  // Root Mutation
  const mutationFields = schema
    .map((type) => {
      const T = typeName(type.__name);
      // expectedLastEditedAt is the optimistic-concurrency token (ADR 0009) —
      // the value the caller last read for this entry's __lastEditedAt.
      // create has none (a fresh id can't conflict).
      return [
        `  create${T}(values: ${T}Input!): ${T}!`,
        `  update${T}(id: ID!, values: ${T}Input!, expectedLastEditedAt: String!): ${T}!`,
        `  patch${T}(id: ID!, values: ${T}Input!, expectedLastEditedAt: String!): ${T}!`,
        `  delete${T}(id: ID!, expectedLastEditedAt: String!): Boolean!`,
        `  publish${T}(id: ID!, expectedLastEditedAt: String!): ${T}!`,
        `  unpublish${T}(id: ID!, expectedLastEditedAt: String!): ${T}!`,
        `  discardDraft${T}(id: ID!, expectedLastEditedAt: String!): ${T}!`,
      ].join('\n');
    })
    .join('\n');
  blocks.push(`type Mutation {\n${mutationFields}\n}`);

  return blocks.join('\n\n') + '\n';
}

function camelOf(type: Type): string {
  const p = typeName(type.__name);
  return p.charAt(0).toLowerCase() + p.slice(1);
}
