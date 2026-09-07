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

describe('the wider toolbar', () => {
  it('reads an <img> back as an image block', () => {
    const { blocks, dropped } = htmlToBlocks(
      '<img src="/media/a.png" alt="A kitchen" width="800" height="600" />'
    );
    expect(dropped).toEqual([]);
    expect(blocks).toEqual([
      {
        type: 'image',
        image: {
          url: '/media/a.png',
          alternativeText: 'A kitchen',
          width: 800,
          height: 600,
        },
      },
    ]);
  });

  it('lifts an image out of the paragraph the editor puts it in', () => {
    // HugeRTE inserts into the current block, so this is the ordinary case —
    // not an edge one. Before the lift, the <img> was an unknown inline node.
    const { blocks, dropped } = htmlToBlocks('<p>before<img src="/m/a.png" alt="" />after</p>');
    expect(dropped).toEqual([]);
    expect(blocks).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'before' }] },
      { type: 'image', image: { url: '/m/a.png', alternativeText: '' } },
      { type: 'paragraph', children: [{ type: 'text', text: 'after' }] },
    ]);
  });

  it('round-trips an image, a quote, a code block, underline and an h5', () => {
    const original: BlocksContent = [
      { type: 'heading', level: 5, children: [{ type: 'text', text: 'Small heading' }] },
      { type: 'quote', children: [{ type: 'text', text: 'Said so.' }] },
      { type: 'code', children: [{ type: 'text', text: 'npm run build' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'under', underline: true }] },
      {
        type: 'image',
        image: { url: '/m/b.png', alternativeText: 'B', width: 4, height: 3 },
      },
    ];
    const { blocks, dropped } = htmlToBlocks(blocksToHtml(original));
    expect(dropped).toEqual([]);
    expect(blocks).toEqual(original);
  });
});
