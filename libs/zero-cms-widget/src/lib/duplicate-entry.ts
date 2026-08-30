import type { Schema } from '@usc/zero-cms-core';
import {
  createCopier,
  type CopierOptions,
  type CopyRootOptions,
  type DuplicateAdapter,
} from './copy-subtree';

export type { DuplicateAdapter } from './copy-subtree';

/**
 * Deep-copy an Entry and everything it owns.
 *
 * A Blog Post's content **is** its `sections` — an array of Entry ids. Copying
 * only the post's own fields would hand back a second post pointing at the
 * *same* sections, so editing the copy would silently rewrite the original.
 * That is the one outcome a "Duplicate" button must not have, so the copy takes
 * its own sections, and their own children, all the way down.
 *
 * Three things are deliberately **not** copied:
 *
 * - **Media.** An `asset` field holds a media id. The copy points at the same
 *   file, because a second upload of identical bytes is a second thing to
 *   replace when the logo changes.
 * - **Standalone content** (`shareTypes`). Some referenced Entries are not
 *   part of the thing being copied — a Project has its own `/projects/:id`
 *   page, a Button is shared by every CTA band on the site. Copying those
 *   would mint an orphan case study, or quietly detach a button from the
 *   site-wide edit that is supposed to reach it. The caller names those Types;
 *   this module has no opinion about which they are.
 * - **Lifecycle.** Copies are created, never published. A duplicate appears as
 *   an unpublished draft, which is what lets an editor rename it before anyone
 *   can read it.
 *
 * Runs entirely on ops that already exist (`locate`, `get`, `create`) — there
 * is no `duplicate` in the RPC protocol and this deliberately does not add one.
 *
 * The traversal itself lives in {@link createCopier}, shared with Templates —
 * see `copy-subtree.ts`. Duplicate is the only caller that runs the **root**
 * through the copier too, which is what `isRoot` is for.
 */

export interface DuplicateEntryOptions
  extends CopierOptions,
    Pick<CopyRootOptions, 'clearFields' | 'renameField' | 'renameSuffix'> {}

export interface DuplicateEntryResult {
  /** The new root Entry's id. */
  id: string;
  /** The new root Entry's Type. */
  type: string;
  /** How many Entries were created, the root included. */
  created: number;
  /**
   * Entries that were re-entered while their own copy was still being built —
   * a reference cycle. Each is shared with the original rather than copied,
   * which is the only way the walk can terminate. Empty for the tree-shaped
   * content this is actually used on.
   */
  cycles: string[];
}

export async function duplicateEntry(
  rootId: string,
  deps: { adapter: DuplicateAdapter; schema: Schema; actor: string },
  options: DuplicateEntryOptions = {}
): Promise<DuplicateEntryResult> {
  const { shareTypes, maxEntries, clearFields, renameField, renameSuffix } = options;

  const copier = createCopier(deps, { shareTypes, maxEntries });

  const rootType = await copier.resolveType(rootId);
  if (!rootType) {
    throw new Error(`duplicateEntry: no entry found for id "${rootId}"`);
  }

  const newId = await copier.copy(rootId, {
    isRoot: true,
    clearFields,
    renameField,
    renameSuffix,
  });

  if (newId === rootId) {
    throw new Error(`duplicateEntry: could not copy "${rootId}" (${rootType})`);
  }

  return { id: newId, type: rootType, created: copier.created, cycles: [...copier.cycles] };
}
