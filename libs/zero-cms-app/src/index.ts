/**
 * @usc/zero-cms-app — React UI to manage a zero-cms instance (Types, Entries,
 * Media). Inject an Adapter from @usc/zero-cms-core. Tailwind-styled, no router.
 */

export { ZeroCmsApp, CmsApp, type ZeroCmsAppProps } from './lib/ZeroCmsApp';
export {
  ZeroCmsProvider,
  useZeroCms,
  type ZeroCmsProviderProps,
  type RichTextComponent,
  type BlocksComponent,
  type NotifyFn,
} from './lib/context';

// Sub-views (compose your own shell) + field extensibility
export { EntriesList, EntryEditor } from './lib/entries';
export { TypeBuilder } from './lib/type-builder';
export { MediaLibrary } from './lib/components/media';
export {
  EntryForm,
  fieldRegistry,
  entryLabel,
  titleField,
  type FormValues,
  type EntryFormProps,
} from './lib/fields';
export { SECTIONS, type Section, type View } from './lib/nav';
export {
  DraftRegistryProvider,
  useDraftRegistry,
  useDraftRegistryOptional,
  type DraftRef,
  type DraftRegistryValue,
} from './lib/draft-registry';
export * as ui from './lib/components/ui';
export { defaultsFor, errorMessage } from './lib/util';

// Auth
export { AuthGate, type AuthConfig, type AuthContext } from './lib/auth/AuthGate';
export {
  createAuthClient,
  type AuthClient,
  type AuthClientOptions,
  type LoginResult,
} from './lib/auth/auth-client';
