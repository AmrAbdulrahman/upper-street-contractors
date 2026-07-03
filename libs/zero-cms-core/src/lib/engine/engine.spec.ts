import { describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { createMemoryStoragePort } from './fs-storage-port';
import type { Schema } from '../model/schema';
import { ZeroCmsError } from '../model/errors';

const schema: Schema = [
  {
    __name: 'author',
    fields: [{ __name: 'name', __type: 'text', required: true }],
  },
  {
    __name: 'project',
    fields: [
      { __name: 'title', __type: 'text', required: true },
      { __name: 'category', __type: 'lookup', options: ['Bathroom', 'Loft'] },
      { __name: 'author', __type: 'reference', allowedTypes: ['author'] },
    ],
  },
];

async function freshEngine() {
  return Engine.load(createMemoryStoragePort({ schema }));
}

describe('draft / publish lifecycle (ADR 0006)', () => {
  it('create lands in draft, not in published reads', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'Loft job' });
    expect(p.__status).toBe('unpublished');
    expect(p.hasDraft).toBe(true);
    expect(e.get('project', p.__id)).toBeNull(); // published read
    expect(e.get('project', p.__id, { status: 'draft' })?.title).toBe('Loft job');
  });

  it('publish moves draft to live values', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A' });
    const pub = await e.publish('project', p.__id);
    expect(pub.__status).toBe('published');
    expect(pub.hasDraft).toBe(false);
    expect(e.get('project', p.__id)?.title).toBe('A');
  });

  it('editing a published entry keeps it live and previewable', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A' });
    await e.publish('project', p.__id);
    await e.update('project', p.__id, { title: 'B' });
    expect(e.get('project', p.__id)?.title).toBe('A'); // live unchanged
    expect(e.get('project', p.__id, { status: 'draft' })?.title).toBe('B');
    const back = await e.discardDraft('project', p.__id);
    expect(back.hasDraft).toBe(false);
    expect(e.get('project', p.__id, { status: 'draft' })?.title).toBe('A');
  });
});

describe('validation', () => {
  it('rejects unknown lookup option', async () => {
    const e = await freshEngine();
    await expect(
      e.create('project', { title: 'A', category: 'Nope' })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('blocks publish when required field missing', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { category: 'Loft' });
    await expect(e.publish('project', p.__id)).rejects.toBeInstanceOf(ZeroCmsError);
  });
});

describe('reference integrity', () => {
  it('blocks deleting an entry referenced by a draft', async () => {
    const e = await freshEngine();
    const a = await e.create('author', { name: 'Jo' });
    await e.create('project', { title: 'P', author: a.__id });
    await expect(e.delete('author', a.__id)).rejects.toMatchObject({
      code: 'REFERENCE_INTEGRITY',
    });
  });

  it('populates a reference', async () => {
    const e = await freshEngine();
    const a = await e.create('author', { name: 'Jo' });
    await e.publish('author', a.__id);
    const p = await e.create('project', { title: 'P', author: a.__id });
    await e.publish('project', p.__id);
    const got = e.get('project', p.__id, { populate: ['author'] });
    expect((got?.author as { name: string }).name).toBe('Jo');
  });
});

describe('query', () => {
  it('filters by where and hides drafts from published reads', async () => {
    const e = await freshEngine();
    const a = await e.create('project', { title: 'Bath one', category: 'Bathroom' });
    await e.publish('project', a.__id);
    await e.create('project', { title: 'Loft two', category: 'Loft' }); // stays draft

    const published = await e.query('project');
    expect(published.total).toBe(1);

    const drafts = await e.query('project', {
      status: 'draft',
      where: { hasDraft: { eq: true } },
    });
    expect(drafts.total).toBe(1);
    expect(drafts.data[0].title).toBe('Loft two');
  });
});

describe('admin includeUnpublished', () => {
  it('hides unpublished-no-draft from preview but shows it with includeUnpublished', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'X' });
    await e.publish('project', p.__id);
    await e.unpublish('project', p.__id); // unpublished, no draft -> hidden from reads

    expect((await e.query('project', { status: 'draft' })).total).toBe(0);
    expect(
      (await e.query('project', { status: 'draft', includeUnpublished: true })).total
    ).toBe(1);
  });

  it('get returns an unpublished-no-draft entry only with includeUnpublished', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'X' });
    await e.publish('project', p.__id);
    await e.unpublish('project', p.__id);

    expect(e.get('project', p.__id, { status: 'draft' })).toBeNull();
    const got = e.get('project', p.__id, {
      status: 'draft',
      includeUnpublished: true,
    });
    expect(got?.title).toBe('X');
  });
});

describe('locate', () => {
  it('resolves an entry type from its id', async () => {
    const e = await freshEngine();
    const a = await e.create('author', { name: 'Jo' });
    expect(e.locate(a.__id)).toEqual({ id: a.__id, type: 'author' });
    expect(e.locate('nope')).toBeNull();
  });
});

describe('media', () => {
  it('stores and blocks deletion while referenced', async () => {
    const withAsset = await Engine.load(
      createMemoryStoragePort({
        schema: [
          { __name: 'pic', fields: [{ __name: 'file', __type: 'asset' }] },
        ],
      })
    );
    const m = await withAsset.putMedia(new Uint8Array([1, 2, 3]), {
      filename: 'a.png',
      mime: 'image/png',
    });
    expect(m.kind).toBe('image');
    await withAsset.create('pic', { file: m.id });
    await expect(withAsset.deleteMedia(m.id)).rejects.toMatchObject({
      code: 'MEDIA_IN_USE',
    });
  });
});
