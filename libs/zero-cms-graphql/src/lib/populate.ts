/**
 * Derive engine `populate` paths from the GraphQL selection set (ADR 0005): any
 * selected reference field becomes a dotted populate path, recursing through
 * nested selections and union inline-fragments. One adapter call then returns the
 * fully-resolved nested entries; GraphQL's default resolvers read them directly.
 */

import { isAbstractType } from 'graphql';
import type {
  GraphQLResolveInfo,
  SelectionSetNode,
  FragmentDefinitionNode,
} from 'graphql';
import type { Schema, Type } from '@usc/zero-cms-core';
import { gqlToCmsTypeMap } from './naming';

function isRef(f: Type['fields'][number]) {
  return f.__type === 'reference' || f.__type === 'references';
}

export function computePopulate(
  info: GraphQLResolveInfo,
  rootCmsType: string,
  schema: Schema,
  opts: { dataField?: string } = {}
): string[] {
  const byName = new Map(schema.map((t) => [t.__name, t]));
  const gqlToCms = gqlToCmsTypeMap(schema);
  const fragments = info.fragments as Record<string, FragmentDefinitionNode>;

  const refsOf = (cmsType: string) => {
    const t = byName.get(cmsType);
    const m = new Map<string, string[]>();
    if (t)
      for (const f of t.fields)
        if (isRef(f)) m.set(f.__name, (f as { allowedTypes: string[] }).allowedTypes);
    return m;
  };

  const out = new Set<string>();

  /**
   * Does a fragment/inline-fragment condition apply to the type we're currently
   * walking? Three cases:
   *  - no condition            → yes, same type.
   *  - names this CMS Type     → yes.
   *  - names an ABSTRACT type  → yes, transparently: a fragment declared on a
   *    union (`fragment X on PageSectionsRef`) carries no type information of
   *    its own, so descend with the current type and let the inline fragments
   *    inside it do the narrowing. Without this a union-typed fragment is
   *    skipped entirely and NOTHING nested inside a section gets populated —
   *    children come back as bare ids and their non-nullable `id` blows up.
   */
  const appliesTo = (condName: string | undefined, cmsType: string): boolean => {
    if (!condName) return true;
    if (gqlToCms.get(condName) === cmsType) return true;
    const condType = info.schema.getType(condName);
    return Boolean(condType && isAbstractType(condType));
  };

  const collect = (sel: SelectionSetNode, cmsType: string, prefix: string) => {
    const refs = refsOf(cmsType);
    for (const node of sel.selections) {
      if (node.kind === 'Field') {
        const allowed = refs.get(node.name.value);
        if (allowed) {
          out.add(prefix + node.name.value);
          if (node.selectionSet)
            for (const at of allowed)
              collect(node.selectionSet, at, `${prefix}${node.name.value}.`);
        }
      } else if (node.kind === 'InlineFragment') {
        if (node.selectionSet && appliesTo(node.typeCondition?.name.value, cmsType))
          collect(node.selectionSet, cmsType, prefix);
      } else if (node.kind === 'FragmentSpread') {
        const frag = fragments[node.name.value];
        if (frag && appliesTo(frag.typeCondition.name.value, cmsType))
          collect(frag.selectionSet, cmsType, prefix);
      }
    }
  };

  // Root field selection (single) or its `data` sub-selection (list).
  const fieldNode = info.fieldNodes[0];
  let selection: SelectionSetNode | undefined = fieldNode.selectionSet;
  if (opts.dataField && selection) {
    const dataNode = selection.selections.find(
      (s) => s.kind === 'Field' && s.name.value === opts.dataField
    );
    selection =
      dataNode && dataNode.kind === 'Field' ? dataNode.selectionSet : undefined;
  }
  if (selection) collect(selection, rootCmsType, '');
  return [...out];
}
