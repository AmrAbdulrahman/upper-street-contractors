/** Fast lookups over a Schema. */

import type { Field, Schema, Type } from '../model/schema';
import { isReferenceField } from '../model/schema';
import { ZeroCmsError } from '../model/errors';

export class SchemaIndex {
  private readonly byName = new Map<string, Type>();

  constructor(public readonly schema: Schema) {
    for (const t of schema) this.byName.set(t.__name, t);
  }

  has(typeName: string): boolean {
    return this.byName.has(typeName);
  }

  get(typeName: string): Type {
    const t = this.byName.get(typeName);
    if (!t) throw new ZeroCmsError('TYPE_NOT_FOUND', `Unknown type "${typeName}"`);
    return t;
  }

  field(typeName: string, fieldName: string): Field | undefined {
    return this.get(typeName).fields.find((f) => f.__name === fieldName);
  }

  referenceFields(typeName: string): Array<Field & { allowedTypes: string[] }> {
    return this.get(typeName).fields.filter(isReferenceField);
  }

  types(): Type[] {
    return this.schema;
  }
}
