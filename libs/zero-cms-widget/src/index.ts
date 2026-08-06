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
} from './lib/context';
export { Drawer, type DrawerProps } from './lib/Drawer';
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
