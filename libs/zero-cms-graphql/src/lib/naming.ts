/** GraphQL naming helpers built on the core casing utilities. */

import { pascalCase, camelCase, type Schema, type Type } from '@usc/zero-cms-core';

export { pascalCase, camelCase };

/** Naive pluralisation for list field names: author -> authors, category -> categories. */
export function plural(name: string): string {
  const c = camelCase(name);
  if (/[^aeiou]y$/.test(c)) return c.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/.test(c)) return c + 'es';
  return c + 's';
}

/** GraphQL object type name for a CMS Type. */
export const typeName = (t: string) => pascalCase(t);

/** Enum name for a lookup field. */
export const lookupEnumName = (type: string, field: string) =>
  `${pascalCase(type)}${pascalCase(field)}`;

/** Union name for a multi-target reference field. */
export const refUnionName = (type: string, field: string) =>
  `${pascalCase(type)}${pascalCase(field)}Ref`;

const GQL_NAME = /^[_A-Za-z][_0-9A-Za-z]*$/;

/** Lookup options can back a GraphQL enum only if every option is a valid name. */
export function lookupCanEnum(options: string[]): boolean {
  return options.length > 0 && options.every((o) => GQL_NAME.test(o));
}

/** Map GraphQL object type name back to the CMS Type `__name`. */
export function gqlToCmsTypeMap(schema: Schema): Map<string, string> {
  return new Map(schema.map((t: Type) => [typeName(t.__name), t.__name]));
}
