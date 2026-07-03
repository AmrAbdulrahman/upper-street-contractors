'use client';

/**
 * <BlocksEditor> — a minimal structured editor for `blocks` content: an ordered
 * list of typed blocks (paragraph / heading / quote / list) with plain text.
 *
 * v1 limitation: editing a block's text replaces its inline children with a single
 * text node, so inline marks (bold/links) on an edited block are not preserved.
 * Read rendering keeps full fidelity via <ZeroCmsBlocks>.
 */

import type { BlocksContent, BlocksNode } from './types';

type Kind = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'ul' | 'ol';

const KINDS: { v: Kind; l: string }[] = [
  { v: 'paragraph', l: 'Paragraph' },
  { v: 'h1', l: 'Heading 1' },
  { v: 'h2', l: 'Heading 2' },
  { v: 'h3', l: 'Heading 3' },
  { v: 'quote', l: 'Quote' },
  { v: 'ul', l: 'Bulleted list' },
  { v: 'ol', l: 'Numbered list' },
];

function flattenText(node: BlocksNode): string {
  if (typeof node.text === 'string') return node.text;
  return (node.children ?? []).map(flattenText).join('');
}

function kindOf(node: BlocksNode): Kind {
  if (node.type === 'heading') {
    const l = Number(node.level) || 1;
    return (l <= 1 ? 'h1' : l === 2 ? 'h2' : 'h3') as Kind;
  }
  if (node.type === 'quote') return 'quote';
  if (node.type === 'list') return node.format === 'ordered' ? 'ol' : 'ul';
  return 'paragraph';
}

function getText(node: BlocksNode): string {
  if (node.type === 'list')
    return (node.children ?? []).map(flattenText).join('\n');
  return flattenText(node);
}

function makeBlock(kind: Kind, text: string): BlocksNode {
  const textNode = (t: string): BlocksNode => ({ type: 'text', text: t });
  switch (kind) {
    case 'h1':
    case 'h2':
    case 'h3':
      return { type: 'heading', level: Number(kind[1]), children: [textNode(text)] };
    case 'quote':
      return { type: 'quote', children: [textNode(text)] };
    case 'ul':
    case 'ol':
      return {
        type: 'list',
        format: kind === 'ol' ? 'ordered' : 'unordered',
        children: text
          .split('\n')
          .map((line) => ({ type: 'list-item', children: [textNode(line)] })),
      };
    default:
      return { type: 'paragraph', children: [textNode(text)] };
  }
}

const inputCls =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-neutral-900';

export interface BlocksEditorProps {
  value: unknown;
  onChange: (value: BlocksContent) => void;
}

export function BlocksEditor({ value, onChange }: BlocksEditorProps) {
  const blocks: BlocksNode[] = Array.isArray(value) ? (value as BlocksNode[]) : [];
  const update = (next: BlocksNode[]) => onChange(next);
  const setBlock = (i: number, node: BlocksNode) =>
    update(blocks.map((b, idx) => (idx === i ? node : b)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  return (
    <div className="space-y-2 rounded-md border border-neutral-300 p-2">
      {blocks.length === 0 && (
        <p className="px-1 text-xs text-neutral-400">No content yet.</p>
      )}
      {blocks.map((b, i) => {
        const kind = kindOf(b);
        const isList = kind === 'ul' || kind === 'ol';
        return (
          <div key={i} className="space-y-1 rounded border border-neutral-200 p-2">
            <div className="flex items-center gap-1">
              <select
                className={inputCls + ' max-w-44'}
                value={kind}
                onChange={(e) => setBlock(i, makeBlock(e.target.value as Kind, getText(b)))}
              >
                {KINDS.map((k) => (
                  <option key={k.v} value={k.v}>
                    {k.l}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
                <button type="button" onClick={() => move(i, -1)} aria-label="Move up">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} aria-label="Move down">
                  ↓
                </button>
                <button
                  type="button"
                  className="text-red-600 hover:underline"
                  onClick={() => update(blocks.filter((_, idx) => idx !== i))}
                >
                  remove
                </button>
              </div>
            </div>
            <textarea
              className={inputCls + ' min-h-16'}
              value={getText(b)}
              placeholder={isList ? 'One item per line' : ''}
              onChange={(e) => setBlock(i, makeBlock(kind, e.target.value))}
            />
          </div>
        );
      })}
      <button
        type="button"
        className="rounded-md border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100"
        onClick={() => update([...blocks, makeBlock('paragraph', '')])}
      >
        + Block
      </button>
    </div>
  );
}
