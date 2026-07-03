/**
 * Field system barrel. Each field renderer lives in its own folder under `fields/`
 * and is wired into `fieldRegistry` (see `registry/`); `EntryForm` (see
 * `entry-form/`) renders them. Public surface consumed by `entries.tsx`, the lib
 * `index.ts`, and the widget drawer.
 */

export { EntryForm, type EntryFormProps } from './entry-form';
export { fieldRegistry, FieldControl } from './registry';
export type { FormValues, RendererProps } from './registry';
export { entryLabel, titleField } from './entry-label';
