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

  it('force-deletes by unlinking a PUBLISHED holder first', async () => {
    const e = await freshEngine();
    const created = await e.create('author', { name: 'Jo' }, ACTOR);
    const a = await e.publish(
      'author',
      created.__id,
      ACTOR,
      created.__lastEditedAt as string
    );
    const p = await e.create('project', { title: 'P', author: a.__id }, ACTOR);
    await e.publish('project', p.__id, ACTOR, p.__lastEditedAt as string);

    // The holder's own published version is the commonest blocker there is:
    // a force that only touched drafts would still refuse this.
    await e.delete('author', a.__id, ACTOR, a.__lastEditedAt as string, true);

    expect(await e.get('author', a.__id, { status: 'draft' })).toBeNull();
    expect((await e.get('project', p.__id))?.author).toBeNull();
  });

  it('force-delete removes one id from a list and leaves its siblings', async () => {
    const e = await freshEngine([
      { __name: 'author', fields: [{ __name: 'name', __type: 'text', required: true }] },
      {
        __name: 'page',
        fields: [
          { __name: 'title', __type: 'text' },
          { __name: 'authors', __type: 'references', allowedTypes: ['author'] },
        ],
      },
    ]);
    const one = await e.create('author', { name: 'One' }, ACTOR);
    const two = await e.create('author', { name: 'Two' }, ACTOR);
    const page = await e.create(
      'page',
      { title: 'P', authors: [one.__id, two.__id] },
      ACTOR
    );
    await e.publish('page', page.__id, ACTOR, page.__lastEditedAt as string);

    await e.delete('author', one.__id, ACTOR, one.__lastEditedAt as string, true);

    expect((await e.get('page', page.__id))?.authors).toEqual([two.__id]);
  });

  it('force-delete clears the same field in both values and draft', async () => {
    const e = await freshEngine();
    const a = await e.create('author', { name: 'Jo' }, ACTOR);
    const p = await e.create('project', { title: 'P', author: a.__id }, ACTOR);
    await e.publish('project', p.__id, ACTOR, p.__lastEditedAt as string);
    // Re-point the draft at the same author, so the holder carries it twice.
    const published = await e.get('project', p.__id);
    await e.patch(
      'project',
      p.__id,
      { author: a.__id },
      ACTOR,
      published?.__lastEditedAt as string
    );

    await e.delete('author', a.__id, ACTOR, a.__lastEditedAt as string, true);

    expect((await e.get('project', p.__id))?.author).toBeNull();
    expect((await e.get('project', p.__id, { status: 'draft' }))?.author).toBeNull();
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

  it('allows removing a field from a Type with published entries', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A', category: 'Loft' }, ACTOR);
    await e.publish('project', p.__id, ACTOR, p.__lastEditedAt as string);

    const nextSchema: Schema = [
      ...schema.filter((t) => t.__name !== 'project'),
      {
        __name: 'project',
        fields: schema
          .find((t) => t.__name === 'project')!
          .fields.filter((f) => f.__name !== 'category'),
      },
    ];

    // The stored bag still has `category`, and always will: `publish` writes the
    // projected values, so every declared field is re-materialised on every
    // publish. Projection drops it at read time (ADR 0011), so the guard must not
    // treat it as an offender — otherwise no field could ever be removed.
    await expect(
      e.saveSchema(nextSchema, ACTOR, await e.getSchemaVersion())
    ).resolves.toBeTruthy();

    const got = await e.get('project', p.__id);
    expect(got?.category).toBeUndefined();
    expect(got?.title).toBe('A');
  });

  it('still refuses a schema edit that invalidates a published value', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A' }, ACTOR);
    await e.publish('project', p.__id, ACTOR, p.__lastEditedAt as string);

    const nextSchema: Schema = [
      ...schema.filter((t) => t.__name !== 'project'),
      {
        __name: 'project',
        // `title` holds the string 'A'; re-kinding it to number leaves a stored
        // value the next schema cannot read.
        fields: [{ __name: 'title', __type: 'number' }],
      },
    ];

    await expect(
      e.saveSchema(nextSchema, ACTOR, await e.getSchemaVersion())
    ).rejects.toMatchObject({ code: 'DESTRUCTIVE_SCHEMA_EDIT' });
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

  // `withoutStamps` is an allowlist, so a Type-level key it doesn't name is
  // dropped on every save and never bumps __updatedAt. Guards both halves.
  it('persists Type-level description/thumbnail and bumps updatedAt for them', async () => {
    const e = await freshEngine();
    const afterCreate = await e.saveSchema(schema, ACTOR, await e.getSchemaVersion());
    const before = afterCreate.find((t) => t.__name === 'project')!;

    const afterEdit = await e.saveSchema(
      afterCreate.map((t) =>
        t.__name === 'project'
          ? { ...t, description: 'A completed renovation', thumbnail: 'imageText' }
          : t
      ),
      ACTOR,
      await e.getSchemaVersion()
    );
    const project = afterEdit.find((t) => t.__name === 'project')!;

    expect(project.description).toBe('A completed renovation');
    expect(project.thumbnail).toBe('imageText');
    expect(project.__updatedAt).not.toBe(before.__updatedAt);
  });
});

describe('entry title override', () => {
  it('setEntryTitle writes __title and surfaces it on reads', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'Loft job' }, ACTOR);
    expect(p.__title).toBeNull();

    const named = await e.setEntryTitle(
      'project',
      p.__id,
      'Islington loft',
      ACTOR,
      p.__lastEditedAt as string
    );
    expect(named.__title).toBe('Islington loft');
    expect((await e.get('project', p.__id, { status: 'draft' }))?.__title).toBe(
      'Islington loft'
    );
  });

  it('trims, and treats blank as clearing the override', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A' }, ACTOR);
    const a = await e.setEntryTitle(
      'project',
      p.__id,
      '  Padded  ',
      ACTOR,
      p.__lastEditedAt as string
    );
    expect(a.__title).toBe('Padded');
    const b = await e.setEntryTitle(
      'project',
      p.__id,
      '   ',
      ACTOR,
      a.__lastEditedAt as string
    );
    expect(b.__title).toBeNull();
    const c = await e.setEntryTitle(
      'project',
      p.__id,
      'Back',
      ACTOR,
      b.__lastEditedAt as string
    );
    expect(c.__title).toBe('Back');
    const d = await e.setEntryTitle(
      'project',
      p.__id,
      null,
      ACTOR,
      c.__lastEditedAt as string
    );
    expect(d.__title).toBeNull();
  });

  it('is a normal CAS write — a stale token conflicts (ADR 0009)', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A' }, ACTOR);
    const stale = p.__lastEditedAt as string;
    await e.setEntryTitle('project', p.__id, 'First', ACTOR, stale);
    await expect(
      e.setEntryTitle('project', p.__id, 'Second', ACTOR, stale)
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('is not draft-gated: an override needs no publish, and publishing keeps it', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A' }, ACTOR);
    const named = await e.setEntryTitle(
      'project',
      p.__id,
      'Islington loft',
      ACTOR,
      p.__lastEditedAt as string
    );
    // Live before any publish...
    expect((await e.get('project', p.__id, { status: 'draft' }))?.__title).toBe(
      'Islington loft'
    );
    // ...and untouched by publish, which only swaps values/__draft.
    const pub = await e.publish(
      'project',
      p.__id,
      ACTOR,
      named.__lastEditedAt as string
    );
    expect(pub.__title).toBe('Islington loft');
    expect((await e.get('project', p.__id))?.__title).toBe('Islington loft');
  });

  it('survives unpublish and discardDraft', async () => {
    const e = await freshEngine();
    const p = await e.create('project', { title: 'A' }, ACTOR);
    const named = await e.setEntryTitle(
      'project',
      p.__id,
      'Kept',
      ACTOR,
      p.__lastEditedAt as string
    );
    const pub = await e.publish(
      'project',
      p.__id,
      ACTOR,
      named.__lastEditedAt as string
    );
    const upd = await e.update(
      'project',
      p.__id,
      { title: 'B' },
      ACTOR,
      pub.__lastEditedAt as string
    );
    expect(upd.__title).toBe('Kept');
    const discarded = await e.discardDraft(
      'project',
      p.__id,
      ACTOR,
      upd.__lastEditedAt as string
    );
    expect(discarded.__title).toBe('Kept');
    const un = await e.unpublish(
      'project',
      p.__id,
      ACTOR,
      discarded.__lastEditedAt as string
    );
    expect(un.__title).toBe('Kept');
  });
});

describe('Type.titleField', () => {
  /**
   * Regression for the `withoutStamps` allowlist: it is an allowlist, not an
   * omit, so a Type key missing from it is silently dropped by saveSchema. This
   * is the only test that catches that.
   */
  it('round-trips through saveSchema', async () => {
    const e = await freshEngine();
    const next: Schema = schema.map((t) =>
      t.__name === 'project' ? { ...t, titleField: 'category' } : t
    );
    const saved = await e.saveSchema(next, ACTOR, await e.getSchemaVersion());
    expect(saved.find((t) => t.__name === 'project')?.titleField).toBe('category');

    // And from storage, not just the returned value.
    const reloaded = await Engine.load(
      createMemoryStoragePort({ schema: saved }),
      createMemoryBlobStore()
    );
    expect(
      reloaded.getSchema().find((t) => t.__name === 'project')?.titleField
    ).toBe('category');
  });

  it('bumps __updatedAt when only the Title field changed', async () => {
    const e = await freshEngine();
    const first = await e.saveSchema(schema, ACTOR, await e.getSchemaVersion());
    const before = first.find((t) => t.__name === 'project')!.__updatedAt;

    const next: Schema = first.map((t) =>
      t.__name === 'project' ? { ...t, titleField: 'category' } : t
    );
    const after = await e.saveSchema(next, ACTOR, await e.getSchemaVersion());
    expect(after.find((t) => t.__name === 'project')!.__updatedAt).not.toBe(before);
  });
});
