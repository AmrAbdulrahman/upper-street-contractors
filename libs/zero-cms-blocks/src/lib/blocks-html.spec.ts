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

  it('reads an image size off inline style when there are no attributes', () => {
    // HugeRTE writes the width/height ATTRIBUTES on an image with no inline
    // style, and switches to `style` once one exists — which is how pasted
    // markup usually arrives. Reading attributes only dropped the size on save.
    const { blocks } = htmlToBlocks(
      '<img src="/media/b.png" alt="B" style="width: 400px; height: 300px" />'
    );
    expect(blocks).toEqual([
      {
        type: 'image',
        image: { url: '/media/b.png', alternativeText: 'B', width: 400, height: 300 },
      },
    ]);
  });

  it('prefers the attribute over the style when both are present', () => {
    const { blocks } = htmlToBlocks(
      '<img src="/m/c.png" alt="" width="800" height="600" style="width: 400px; height: 300px" />'
    );
    expect(blocks[0]).toMatchObject({ image: { width: 800, height: 600 } });
  });

  it('ignores a size a pixel box cannot hold', () => {
    // A percentage or a keyword is not a number of pixels, and guessing one
    // would write a wrong size into the store rather than leaving it unset.
    const { blocks } = htmlToBlocks('<img src="/m/d.png" alt="" style="width: 50%; height: auto" />');
    expect(blocks).toEqual([
      { type: 'image', image: { url: '/m/d.png', alternativeText: '' } },
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
