import { describe, it, expect } from 'vitest';
import { blocksToHtml, htmlToBlocks } from './blocks-html';
import type { BlocksContent } from './types';

describe('htmlToBlocks — lists', () => {
  it('keeps plain list-item text (regression: bare <li> text was dropped)', () => {
    const { blocks } = htmlToBlocks('<ul><li>first</li><li>second</li></ul>');
    expect(blocks).toEqual([
      {
        type: 'list',
        format: 'unordered',
        children: [
          { type: 'list-item', children: [{ type: 'text', text: 'first' }] },
          { type: 'list-item', children: [{ type: 'text', text: 'second' }] },
        ],
      },
    ]);
  });

  it('keeps marks and links inside list items', () => {
    const { blocks } = htmlToBlocks(
      '<ol><li>plain <strong>bold</strong> <a href="/x">link</a></li></ol>'
    );
    expect(blocks[0]).toMatchObject({ type: 'list', format: 'ordered' });
    const item = (blocks[0] as { children: unknown[] }).children[0] as {
      children: unknown[];
    };
    expect(item.children).toEqual([
      { type: 'text', text: 'plain ' },
      { type: 'text', text: 'bold', bold: true },
      { type: 'text', text: ' ' },
      { type: 'link', url: '/x', children: [{ type: 'text', text: 'link' }] },
    ]);
  });

  it('keeps nested lists and their text', () => {
    const { blocks } = htmlToBlocks('<ul><li>outer<ul><li>inner</li></ul></li></ul>');
    const outer = (blocks[0] as { children: { children: unknown[] }[] }).children[0];
    expect(outer.children).toEqual([
      { type: 'text', text: 'outer' },
      {
        type: 'list',
        format: 'unordered',
        children: [{ type: 'list-item', children: [{ type: 'text', text: 'inner' }] }],
      },
    ]);
  });
});

describe('blocks ↔ HTML round-trip', () => {
  it('preserves a list with text through blocksToHtml → htmlToBlocks', () => {
    const original: BlocksContent = [
      {
        type: 'list',
        format: 'unordered',
        children: [
          { type: 'list-item', children: [{ type: 'text', text: 'your name;' }] },
          { type: 'list-item', children: [{ type: 'text', text: 'your project;' }] },
        ],
      },
    ];
    const { blocks } = htmlToBlocks(blocksToHtml(original));
    expect(blocks).toEqual(original);
  });
});
