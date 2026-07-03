/** Block/inline node types (Strapi-blocks-compatible) + override component maps. */

import type { ReactNode } from 'react';
import type { BlocksContent, BlocksNode } from '@usc/zero-cms-core';

export type { BlocksContent, BlocksNode };

export type Modifier =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'code';

export interface TextNode {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

export interface ImageData {
  url: string;
  alternativeText?: string | null;
  width?: number | null;
  height?: number | null;
}

/** Component overrides per block kind (mirrors @strapi/blocks-react-renderer). */
export interface BlockComponents {
  paragraph?: (p: { children: ReactNode }) => ReactNode;
  heading?: (p: { children: ReactNode; level: 1 | 2 | 3 | 4 | 5 | 6 }) => ReactNode;
  list?: (p: { children: ReactNode; format: 'ordered' | 'unordered' }) => ReactNode;
  'list-item'?: (p: { children: ReactNode }) => ReactNode;
  quote?: (p: { children: ReactNode }) => ReactNode;
  code?: (p: { children: ReactNode; plainText: string }) => ReactNode;
  image?: (p: { image: ImageData }) => ReactNode;
  link?: (p: { children: ReactNode; url: string }) => ReactNode;
}

export type ModifierComponents = Partial<
  Record<Modifier, (p: { children: ReactNode }) => ReactNode>
>;

export interface ZeroCmsBlocksProps {
  content: unknown;
  blocks?: BlockComponents;
  modifiers?: ModifierComponents;
}
