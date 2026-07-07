import { describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { createMemoryStoragePort, createMemoryBlobStore } from './fs-storage-port';
import type { Schema } from '../model/schema';
import { ZeroCmsError } from '../model/errors';

const ACTOR = 'tester';

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

async function freshEngine(customSchema: Schema = schema) {
  return Engine.load(
    createMemoryStoragePort({ schema: customSchema }),
    createMemoryBlobStore()
  );
}

describe('draft / publish lifecycle (ADR 0006)', () => {
  it('create lands in draft, not in published reads', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'Loft job' }, ACTOR);
    expect(p.__status).toBe('unpublished');
    expect(p.hasDraft).toBe(true);
    expect(await e.get('project', p.__id)).toBeNull(); // published read
    expect((await e.get('project', p.__id, { status: 'draft' }))?.title).toBe('Loft job');
  });

  it('publish moves draft to live values', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A' }, ACTOR);
    const pub = await e.publish('project', p.__id, ACTOR, p.__lastEditedAt as string);
    expect(pub.__status).toBe('published');
    expect(pub.hasDraft).toBe(false);
    expect((await e.get('project', p.__id))?.title).toBe('A');
  });

  it('editing a published entry keeps it live and previewable', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A' }, ACTOR);
    const pub = await e.publish('project', p.__id, ACTOR, p.__lastEditedAt as string);
    const upd = await e.update(
      'project',
      p.__id,
      { title: 'B' },
      ACTOR,
      pub.__lastEditedAt as string
    );
    expect((await e.get('project', p.__id))?.title).toBe('A'); // live unchanged
    expect((await e.get('project', p.__id, { status: 'draft' }))?.title).toBe('B');
    const back = await e.discardDraft('project', p.__id, ACTOR, upd.__lastEditedAt as string);
    expect(back.hasDraft).toBe(false);
    expect((await e.get('project', p.__id, { status: 'draft' }))?.title).toBe('A');
  });

  it('rejects a mutation against a stale expectedLastEditedAt (ADR 0009)', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A' }, ACTOR);
    await e.update('project', p.__id, { title: 'B' }, ACTOR, p.__lastEditedAt as string);
    // p.__lastEditedAt is now stale — the update above already bumped it.
    await expect(
      e.update('project', p.__id, { title: 'C' }, ACTOR, p.__lastEditedAt as string)
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('validation', () => {
  it('rejects unknown lookup option', async () => {
    const e = await freshEngine();
    await expect(
      e.create('project', { title: 'A', category: 'Nope' }, ACTOR)
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('blocks publish when required field missing', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { category: 'Loft' }, ACTOR);
    await expect(
      e.publish('project', p.__id, ACTOR, p.__lastEditedAt as string)
    ).rejects.toBeInstanceOf(ZeroCmsError);
  });
});

describe('reference integrity', () => {
  it('blocks deleting an entry referenced by a draft', async () => {
    const e = await freshEngine();
    const a = await e.create('author', { name: 'Jo' }, ACTOR);
    await e.create('project', { title: 'P', author: a.__id }, ACTOR);
    await expect(
      e.delete('author', a.__id, ACTOR, a.__lastEditedAt as string)
    ).rejects.toMatchObject({ code: 'REFERENCE_INTEGRITY' });
  });

  it('populates a reference', async () => {
    const e = await freshEngine();
    const a = await e.create('author', { name: 'Jo' }, ACTOR);
    await e.publish('author', a.__id, ACTOR, a.__lastEditedAt as string);
    const p = await e.create('project', { title: 'P', author: a.__id }, ACTOR);
    await e.publish('project', p.__id, ACTOR, p.__lastEditedAt as string);
    const got = await e.get('project', p.__id, { populate: ['author'] });
    expect((got?.author as { name: string }).name).toBe('Jo');
  });
});

describe('query', () => {
  it('filters by where and hides drafts from published reads', async () => {
    const e = await freshEngine();
    const a = await e.create('project', { title: 'Bath one', category: 'Bathroom' }, ACTOR);
    await e.publish('project', a.__id, ACTOR, a.__lastEditedAt as string);
    await e.create('project', { title: 'Loft two', category: 'Loft' }, ACTOR); // stays draft

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
    const p = await e.create('project', { title: 'X' }, ACTOR);
    const pub = await e.publish('project', p.__id, ACTOR, p.__lastEditedAt as string);
    await e.unpublish('project', p.__id, ACTOR, pub.__lastEditedAt as string); // unpublished, no draft -> hidden

    expect((await e.query('project', { status: 'draft' })).total).toBe(0);
    expect(
      (await e.query('project', { status: 'draft', includeUnpublished: true })).total
    ).toBe(1);
  });

  it('get returns an unpublished-no-draft entry only with includeUnpublished', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'X' }, ACTOR);
    const pub = await e.publish('project', p.__id, ACTOR, p.__lastEditedAt as string);
    await e.unpublish('project', p.__id, ACTOR, pub.__lastEditedAt as string);

    expect(await e.get('project', p.__id, { status: 'draft' })).toBeNull();
    const got = await e.get('project', p.__id, { status: 'draft', includeUnpublished: true });
    expect(got?.title).toBe('X');
  });
});

describe('locate', () => {
  it('resolves an entry type from its id', async () => {
    const e = await freshEngine();
    const a = await e.create('author', { name: 'Jo' }, ACTOR);
    expect(await e.locate(a.__id)).toEqual({ id: a.__id, type: 'author' });
    expect(await e.locate('nope')).toBeNull();
  });
});

describe('media', () => {
  it('stores and blocks deletion while referenced', async () => {
    const withAsset = await freshEngine([
      { __name: 'pic', fields: [{ __name: 'file', __type: 'asset' }] },
    ]);
    const m = await withAsset.putMedia(
      new Uint8Array([1, 2, 3]),
      { filename: 'a.png', mime: 'image/png' },
      ACTOR
    );
    expect(m.kind).toBe('image');
    await withAsset.create('pic', { file: m.id }, ACTOR);
    await expect(
      withAsset.deleteMedia(m.id, ACTOR, m.updatedAt)
    ).rejects.toMatchObject({ code: 'MEDIA_IN_USE' });
  });

  it('updateMediaMeta enforces optimistic concurrency', async () => {
    const e = await freshEngine();
    const m = await e.putMedia(
      new Uint8Array([1]),
      { filename: 'a.png', mime: 'image/png' },
      ACTOR
    );
    // The CAS token is a millisecond-resolution timestamp — back-to-back awaits can
    // otherwise land in the same millisecond and defeat the staleness check below.
    await new Promise((r) => setTimeout(r, 2));
    await e.updateMediaMeta(m.id, { alternativeText: 'Alt' }, ACTOR, m.updatedAt);
    await expect(
      e.updateMediaMeta(m.id, { alternativeText: 'Alt 2' }, ACTOR, m.updatedAt) // stale now
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('schema evolution (ADR 0011)', () => {
  it('read-time projection injects defaults for fields added after an entry existed', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A' }, ACTOR);

    const nextSchema: Schema = [
      ...schema.filter((t) => t.__name !== 'project'),
      {
        __name: 'project',
        fields: [
          ...schema.find((t) => t.__name === 'project')!.fields,
          { __name: 'featured', __type: 'boolean', default: false },
        ],
      },
    ];
    await e.saveSchema(nextSchema, ACTOR, await e.getSchemaVersion());

    const got = await e.get('project', p.__id, { status: 'draft' });
    expect(got?.featured).toBe(false); // injected, never written to the stored entry
  });

  it('eager backfill writes the default into existing entries', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A' }, ACTOR);
    await e.publish('project', p.__id, ACTOR, p.__lastEditedAt as string);

    const nextSchema: Schema = [
      ...schema.filter((t) => t.__name !== 'project'),
      {
        __name: 'project',
        fields: [
          ...schema.find((t) => t.__name === 'project')!.fields,
          { __name: 'featured', __type: 'boolean', default: true },
        ],
      },
    ];
    await e.saveSchema(nextSchema, ACTOR, await e.getSchemaVersion(), [
      { type: 'project', field: 'featured', default: true },
    ]);

    const got = await e.get('project', p.__id);
    expect(got?.featured).toBe(true);
  });
});

describe('schema Type timestamps', () => {
  it('stamps a brand-new Type with matching createdAt/updatedAt', async () => {
    const e = await freshEngine();
    const saved = await e.saveSchema(
      [...schema, { __name: 'tag', fields: [{ __name: 'name', __type: 'text' }] }],
      ACTOR,
      await e.getSchemaVersion()
    );
    const tag = saved.find((t) => t.__name === 'tag')!;
    expect(tag.__createdAt).toBeTruthy();
    expect(tag.__createdAt).toBe(tag.__updatedAt);
  });

  it('preserves createdAt and bumps updatedAt when a Type changes', async () => {
    const e = await freshEngine();
    const v1 = await e.getSchemaVersion();
    const afterCreate = await e.saveSchema(schema, ACTOR, v1);
    const createdAt = afterCreate.find((t) => t.__name === 'project')!.__createdAt;

    const v2 = await e.getSchemaVersion();
    const nextSchema: Schema = afterCreate.map((t) =>
      t.__name === 'project' ? { ...t, label: 'Project' } : t
    );
    const afterEdit = await e.saveSchema(nextSchema, ACTOR, v2);
    const project = afterEdit.find((t) => t.__name === 'project')!;

    expect(project.__createdAt).toBe(createdAt);
    expect(project.__updatedAt).not.toBe(createdAt);
  });

  it('leaves both timestamps untouched on a no-op save', async () => {
    const e = await freshEngine();
    const v1 = await e.getSchemaVersion();
    const afterCreate = await e.saveSchema(schema, ACTOR, v1);
    const author = afterCreate.find((t) => t.__name === 'author')!;

    const v2 = await e.getSchemaVersion();
    // Re-save the exact same schema, only the unrelated `project` type edited.
    const nextSchema: Schema = afterCreate.map((t) =>
      t.__name === 'project' ? { ...t, label: 'Project' } : t
    );
    const afterEdit = await e.saveSchema(nextSchema, ACTOR, v2);
    const authorAfter = afterEdit.find((t) => t.__name === 'author')!;

    expect(authorAfter.__createdAt).toBe(author.__createdAt);
    expect(authorAfter.__updatedAt).toBe(author.__updatedAt);
  });
});
