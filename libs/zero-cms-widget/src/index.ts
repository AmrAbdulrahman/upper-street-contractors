/**
 * @usc/zero-cms-widget — an in-place edit drawer for zero-cms. Wrap your app with
 * <ZeroCmsWidget> and call useZeroCmsWidget().openEntry(id) to edit an entry by id
 * without leaving the page. Inject an Adapter from @usc/zero-cms-core.
 *
 * In inspect mode, <ZeroCmsEntry> / <ZeroCmsEntryField> add hover "edit" pencils
 * that open the drawer (an entry, or an entry focused on one field).
 */

export { ZeroCmsWidget, type ZeroCmsWidgetProps } from './lib/ZeroCmsWidget';
export {
  useZeroCmsWidget,
  // Null-safe variant — for host components that also render on public pages,
  // where no <ZeroCmsWidget> is mounted at all.
  useZeroCmsWidgetOptional,
  type OpenOptions,
  type ParentFieldRef,
  type CreateOptions,
  type UnlinkOptions,
  type LinkOptions,
  type ReorderOptions,
  type TypePickerContext,
  type DuplicateOptions,
  type TemplatePickerContext,
  type TemplatePickResult,
  type CreateFromTemplateOptions,
  type SaveAsTemplateOptions,
} from './lib/context';
export {
  duplicateEntry,
  type DuplicateAdapter,
  type DuplicateEntryOptions,
  type DuplicateEntryResult,
} from './lib/duplicate-entry';
export {
  instantiateFrom,
  type InstantiateFromOptions,
  type InstantiateFromResult,
} from './lib/instantiate-template';
export { Drawer, type DrawerProps } from './lib/Drawer';
export { BusyOverlay, type BusyOverlayProps } from './lib/BusyOverlay';
export { ZeroCmsBar, type ZeroCmsBarProps } from './lib/ZeroCmsBar';

// Inspect-mode wrappers
export { ZeroCmsEntry, type ZeroCmsEntryProps } from './lib/inspect/ZeroCmsEntry';
export {
  ZeroCmsEntryField,
  type ZeroCmsEntryFieldProps,
} from './lib/inspect/ZeroCmsEntryField';
export {
  ZeroCmsRelationEntry,
  type ZeroCmsRelationEntryProps,
} from './lib/inspect/ZeroCmsRelationEntry';
export {
  AddZeroCmsEntry,
  type AddZeroCmsEntryProps,
} from './lib/inspect/AddZeroCmsEntry';
export {
  ZeroCmsEntryActions,
  type ZeroCmsEntryActionsProps,
} from './lib/inspect/ZeroCmsEntryActions';
export { ZeroCmsList, type ZeroCmsListProps } from './lib/inspect/ZeroCmsList';
export {
  ZeroCmsSectionList,
  type ZeroCmsSectionListProps,
} from './lib/inspect/ZeroCmsSectionList';
export {
  ZeroCmsEntryProvider,
  useZeroCmsEntry,
  entryRefId,
  entryRefType,
  type ZeroCmsEntryRef,
  type ZeroCmsEntryContextValue,
} from './lib/inspect/entry-context';
export {
  InspectHost,
  wrapWithInspect,
  mergeClassNames,
} from './lib/inspect/inspect-clone';
/**
 * Offers a duplicate button on the hover cluster of the <ZeroCmsEntry> beneath.
 * The host supplies the options because ADR 0017 keeps `shareTypes` a parameter,
 * not something this library guesses.
 */
export {
  DuplicateActionProvider,
  useDuplicateAction,
  type DuplicateActionValue,
} from './lib/inspect/duplicate-action-context';
/**
 * Offers a "save as template" button on the same cluster. The host supplies the
 * kind and the field map for the same reason: which lists a Template holds is a
 * fact about the host's content model, not this library's.
 */
export {
  TemplateActionProvider,
  useTemplateAction,
  type TemplateActionValue,
} from './lib/inspect/template-action-context';
/**
 * Offers a delete button on the same cluster, for an entry that is its own
 * content rather than a slot in some page — a Project card. The host names the
 * noun; the confirm and the reference-integrity reporting live in the library.
 */
export {
  DeleteActionProvider,
  useDeleteAction,
  type DeleteActionValue,
} from './lib/inspect/delete-action-context';
export {
  useSurfaceTone,
  surfaceToneOf,
  type SurfaceTone,
} from './lib/inspect/use-surface-tone';
/**
 * Host apps that render their own inspect-only UI must gate it on this, never on
 * `useZeroCmsWidget().inspect` — see the hook's own comment for why the context
 * flag alone produces hydration mismatches.
 */
export { useInspect } from './lib/inspect/use-inspect';
