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
  type OpenOptions,
  type CreateOptions,
  type UnlinkOptions,
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
export { ZeroCmsList, type ZeroCmsListProps } from './lib/inspect/ZeroCmsList';
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
