'use client';

/**
 * <ZeroCmsBlocks> — renders Strapi-blocks-compatible structured rich text. A
 * dependency-free, overridable replacement for @strapi/blocks-react-renderer.
 */

import { Fragment, type ReactNode } from 'react';
import type {
  BlockComponents,
  ImageData,
  ModifierComponents,
  TextNode,
  ZeroCmsBlocksProps,
} from './types';

type Node = Record<string, unknown> & { type?: string; children?: Node[] };

const MODIFIERS: Array<keyof TextNode> = [
  'code',
  'bold',
  'italic',
  'underline',
  'strikethrough',
];

const defaultModifier: Record<string, (c: ReactNode) => ReactNode> = {
  bold: (c) => <strong>{c}</strong>,
  italic: (c) => <em>{c}</em>,
  underline: (c) => <u>{c}</u>,
  strikethrough: (c) => <s>{c}</s>,
  code: (c) => <code>{c}</code>,
};

function renderText(
  node: TextNode,
  key: number,
  modifiers: ModifierComponents
): ReactNode {
  let out: ReactNode = node.text ?? '';
  for (const mod of MODIFIERS) {
    if (mod === 'text') continue;
    if (node[mod]) {
      const override = modifiers[mod as keyof ModifierComponents];
      out = override
        ? override({ children: out })
        : defaultModifier[mod as string](out);
    }
  }
  return <Fragment key={key}>{out}</Fragment>;
}

function isText(node: Node): node is Node & TextNode {
  return typeof node.text === 'string' && node.type !== 'link';
}

export function ZeroCmsBlocks({
  content,
  blocks = {},
  modifiers = {},
}: ZeroCmsBlocksProps): ReactNode {
  if (!Array.isArray(content) || content.length === 0) return null;

  const children = (nodes: Node[] | undefined): ReactNode =>
    (nodes ?? []).map((n, i) => renderNode(n, i, blocks, modifiers));

  function renderNode(
    node: Node,
    key: number,
    b: BlockComponents,
    m: ModifierComponents
  ): ReactNode {
    if (isText(node)) return renderText(node as TextNode, key, m);

    const kids = children(node.children);

    switch (node.type) {
      case 'link': {
        const url = String(node.url ?? '#');
        return b.link ? (
          <Fragment key={key}>{b.link({ children: kids, url })}</Fragment>
        ) : (
          <a key={key} href={url}>
            {kids}
          </a>
        );
      }
      case 'heading': {
        const level = (Number(node.level) || 1) as 1 | 2 | 3 | 4 | 5 | 6;
        if (b.heading)
          return <Fragment key={key}>{b.heading({ children: kids, level })}</Fragment>;
        const H = `h${level}` as const;
        return <H key={key}>{kids}</H>;
      }
      case 'list': {
        const format = node.format === 'ordered' ? 'ordered' : 'unordered';
        if (b.list)
          return <Fragment key={key}>{b.list({ children: kids, format })}</Fragment>;
        const L = format === 'ordered' ? 'ol' : 'ul';
        return <L key={key}>{kids}</L>;
      }
      case 'list-item':
        return b['list-item'] ? (
          <Fragment key={key}>{b['list-item']({ children: kids })}</Fragment>
        ) : (
          <li key={key}>{kids}</li>
        );
      case 'quote':
        return b.quote ? (
          <Fragment key={key}>{b.quote({ children: kids })}</Fragment>
        ) : (
          <blockquote key={key}>{kids}</blockquote>
        );
      case 'code': {
        const plainText = (node.children ?? [])
          .map((c) => (typeof c.text === 'string' ? c.text : ''))
          .join('');
        return b.code ? (
          <Fragment key={key}>{b.code({ children: kids, plainText })}</Fragment>
        ) : (
          <pre key={key}>
            <code>{plainText}</code>
          </pre>
        );
      }
      case 'image': {
        const image = (node.image as ImageData) ?? { url: '' };
        if (b.image) return <Fragment key={key}>{b.image({ image })}</Fragment>;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={key}
            src={image.url}
            alt={image.alternativeText ?? ''}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
          />
        );
      }
      case 'paragraph':
      default:
        return b.paragraph ? (
          <Fragment key={key}>{b.paragraph({ children: kids })}</Fragment>
        ) : (
          <p key={key}>{kids}</p>
        );
    }
  }

  return <>{children(content as Node[])}</>;
}
