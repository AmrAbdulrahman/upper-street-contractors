/**
 * @usc/zero-cms-blocks — render + edit structured `blocks` rich text (a
 * dependency-free, Strapi-blocks-compatible replacement for
 * @strapi/blocks-react-renderer).
 */

export { ZeroCmsBlocks } from './lib/renderer';
export { BlocksEditor, type BlocksEditorProps } from './lib/editor';
export type {
  BlocksContent,
  BlocksNode,
  TextNode,
  ImageData,
  Modifier,
  BlockComponents,
  ModifierComponents,
  ZeroCmsBlocksProps,
} from './lib/types';
