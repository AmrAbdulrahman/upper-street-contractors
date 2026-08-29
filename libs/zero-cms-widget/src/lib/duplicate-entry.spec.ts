import { describe, it, expect } from 'vitest';
import { createNodeAdapter, createMemoryStoragePort } from '@usc/zero-cms-core/node';
import type { Adapter, Schema } from '@usc/zero-cms-core';
import { duplicateEntry } from './duplicate-entry';

/**
 * A miniature of the real model: a post owning an ordered list of sections,
 * a section owning one child, and two Types that are NOT part of a post —
 * a `project` (its own URL) and a `button` (shared site-wide).
 */
const schema: Schema = [
  {
    __name: 'post',
    label: 'Post',
    fields: [
      { __name: 'title', __type: 'text' },
      { __name: 'slug', __type: 'slug', from: 'title' },
      { __name: 'hero', __type: 'asset', accept: 'image' },
      { __name: 'sections', __type: 'references', allowedTypes: ['block', 'pinned'] },
    ],
  },
  {
    __name: 'block',
    label: 'Block',
    fields: [
      { __name: 'heading', __type: 'text' },
      { __name: 'child', __type: 'reference', allowedTypes: ['leaf'] },
      { __name: 'cta', __type: 'reference', allowedTypes: ['button'] },
    ],
  },
  {
    __name: 'leaf',
    label: 'Leaf',
    fields: [{ __name: 'text', __type: 'text' }],
  },
  {
    __name: 'pinned',
    label: 'Pinned',
    fields: [{ __name: 'projects', __type: 'references', allowedTypes: ['project'] }],
  },
  {
    __name: 'project',
    label: 'Project',
    fields: [{ __name: 'name', __type: 'text' }],
  },
  {
    __name: 'button',
    label: 'Button',
    fields: [{ __name: 'label', __type: 'text' }],
  },
  {
    __name: 'loop',
    label: 'Loop',
    fields: [{ __name: 'next', __type: 'reference', allowedTypes: ['loop'] }],
  },
];

const ACTOR = 'test';

async function makeAdapter(): Promise<Adapter> {
  return createNodeAdapter(createMemoryStoragePort({ schema }));
}

function deps(adapter: Adapter) {
  return { adapter, schema, actor: ACTOR };
}

/** Read an entry back the way the copy was written — as a draft. */
async function read(adapter: Adapter, type: string, id: string) {
  return adapter.get(type, id, { status: 'draft', includeUnpublished: true });
}

describe('duplicateEntry', () => {
  it('copies owned children so the copy is independent of the original', async () => {
    const adapter = await makeAdapter();

    const leaf = await adapter.create('leaf', { text: 'original leaf' }, ACTOR);
    const block = await adapter.create(
      'block',
      { heading: 'original heading', child: leaf.__id },
      ACTOR
    );
    const post = await adapter.create(
      'post',
      { title: 'My Post', sections: [block.__id] },
      ACTOR
    );

    const result = await duplicateEntry(post.__id, deps(adapter));

    // post + block + leaf
    expect(result.created).toBe(3);
    expect(result.cycles).toEqual([]);
    expect(result.id).not.toBe(post.__id);

    const copy = await read(adapter, 'post', result.id);
    const copiedBlockId = (copy?.sections as string[])[0];
    expect(copiedBlockId).not.toBe(block.__id);

    const copiedBlock = await read(adapter, 'block', copiedBlockId);
    const copiedLeafId = copiedBlock?.child as string;
    expect(copiedLeafId).not.toBe(leaf.__id);

    // The whole point: editing the copy must not reach the original.
    await adapter.update(
      'block',
      copiedBlockId,
      { heading: 'edited in the copy', child: copiedLeafId },
      ACTOR,
      copiedBlock!.__lastEditedAt
    );

    const originalBlock = await read(adapter, 'block', block.__id);
    expect(originalBlock?.heading).toBe('original heading');
  });

  it('clears the slug and suffixes the title on the root only', async () => {
    const adapter = await makeAdapter();

    const leaf = await adapter.create('leaf', { text: 'x' }, ACTOR);
    const block = await adapter.create('block', { heading: 'kept', child: leaf.__id }, ACTOR);
    const post = await adapter.create(
      'post',
      { title: 'My Post', slug: 'my-post', sections: [block.__id] },
      ACTOR
    );

    const result = await duplicateEntry(post.__id, deps(adapter), {
      clearFields: ['slug'],
      renameField: 'title',
    });

    const copy = await read(adapter, 'post', result.id);
    expect(copy?.title).toBe('My Post (copy)');
    // Never the original slug — a duplicate silently shadows it on the route.
    expect(copy?.slug).not.toBe('my-post');

    // The suffix and the clear are root-only; a child keeps its own heading.
    const copiedBlock = await read(adapter, 'block', (copy?.sections as string[])[0]);
    expect(copiedBlock?.heading).toBe('kept');
  });

  it('shares media rather than re-uploading it', async () => {
    const adapter = await makeAdapter();

    const mediaId = 'media-abc-123';
    const post = await adapter.create(
      'post',
      { title: 'With hero', hero: mediaId, sections: [] },
      ACTOR
    );

    const result = await duplicateEntry(post.__id, deps(adapter));

    // An `asset` field holds a media id, and it is carried across by value like
    // any other non-reference field — so the copy points at the same file. A
    // second upload of identical bytes is a second thing to replace later.
    const copy = await read(adapter, 'post', result.id);
    expect(copy?.hero).toBe(mediaId);
  });

  it('collapses a diamond — one shared child becomes exactly one copy', async () => {
    const adapter = await makeAdapter();

    const leaf = await adapter.create('leaf', { text: 'shared' }, ACTOR);
    const a = await adapter.create('block', { heading: 'a', child: leaf.__id }, ACTOR);
    const b = await adapter.create('block', { heading: 'b', child: leaf.__id }, ACTOR);
    const post = await adapter.create(
      'post',
      { title: 'Diamond', sections: [a.__id, b.__id] },
      ACTOR
    );

    const result = await duplicateEntry(post.__id, deps(adapter));

    // post + 2 blocks + ONE leaf, not two.
    expect(result.created).toBe(4);

    const copy = await read(adapter, 'post', result.id);
    const [copiedA, copiedB] = copy?.sections as string[];
    const blockA = await read(adapter, 'block', copiedA);
    const blockB = await read(adapter, 'block', copiedB);

    expect(blockA?.child).toBe(blockB?.child);
    expect(blockA?.child).not.toBe(leaf.__id);
  });

  it('shares the Types the caller names instead of copying them', async () => {
    const adapter = await makeAdapter();

    const project = await adapter.create('project', { name: 'Real case study' }, ACTOR);
    const button = await adapter.create('button', { label: 'Request a Quote' }, ACTOR);
    const pinned = await adapter.create('pinned', { projects: [project.__id] }, ACTOR);
    const block = await adapter.create('block', { heading: 'cta', cta: button.__id }, ACTOR);
    const post = await adapter.create(
      'post',
      { title: 'Shares', sections: [pinned.__id, block.__id] },
      ACTOR
    );

    const result = await duplicateEntry(post.__id, deps(adapter), {
      shareTypes: ['project', 'button'],
    });

    // post + pinned + block. The project and the button are shared.
    expect(result.created).toBe(3);

    const copy = await read(adapter, 'post', result.id);
    const [copiedPinned, copiedBlock] = copy?.sections as string[];

    const pinnedCopy = await read(adapter, 'pinned', copiedPinned);
    expect(pinnedCopy?.projects).toEqual([project.__id]);

    const blockCopy = await read(adapter, 'block', copiedBlock);
    expect(blockCopy?.cta).toBe(button.__id);
  });

  it('terminates on a reference cycle and reports it', async () => {
    const adapter = await makeAdapter();

    const a = await adapter.create('loop', {}, ACTOR);
    const b = await adapter.create('loop', { next: a.__id }, ACTOR);
    await adapter.patch('loop', a.__id, { next: b.__id }, ACTOR, a.__lastEditedAt);

    const result = await duplicateEntry(a.__id, deps(adapter));

    expect(result.created).toBe(2);
    expect(result.cycles).toContain(a.__id);

    // The loop is closed by sharing the original, which is what bounds the walk.
    const copyA = await read(adapter, 'loop', result.id);
    const copyB = await read(adapter, 'loop', copyA?.next as string);
    expect(copyB?.next).toBe(a.__id);
  });

  it('refuses to run away past maxEntries', async () => {
    const adapter = await makeAdapter();

    const leaf = await adapter.create('leaf', { text: 'x' }, ACTOR);
    const blocks = [];
    for (let i = 0; i < 5; i += 1) {
      const block = await adapter.create(
        'block',
        { heading: `b${i}`, child: leaf.__id },
        ACTOR
      );
      blocks.push(block.__id);
    }
    const post = await adapter.create('post', { title: 'Big', sections: blocks }, ACTOR);

    await expect(
      duplicateEntry(post.__id, deps(adapter), { maxEntries: 3 })
    ).rejects.toThrow(/refusing to copy more than 3/);
  });

  it('throws on an id that resolves to nothing', async () => {
    const adapter = await makeAdapter();

    await expect(
      duplicateEntry('does-not-exist', deps(adapter))
    ).rejects.toThrow(/no entry found/);
  });
});
