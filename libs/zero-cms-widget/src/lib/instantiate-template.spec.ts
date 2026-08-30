import { describe, it, expect } from 'vitest';
import { createNodeAdapter, createMemoryStoragePort } from '@usc/zero-cms-core/node';
import type { Adapter, Schema } from '@usc/zero-cms-core';
import { instantiateFrom } from './instantiate-template';

/**
 * A miniature of the real model. `template` carries kind-specific slots — a
 * `sections` list for the blog/service kinds and two owned child lists for the
 * project kind — because a Project has no `sections` to give it.
 *
 * `project` and `button` stand for the standalone Types a copy must share:
 * a Project has its own URL, a Button is site-wide.
 */
const schema: Schema = [
  {
    __name: 'template',
    label: 'Template',
    fields: [
      { __name: 'name', __type: 'text' },
      { __name: 'kind', __type: 'lookup', options: ['blog', 'service', 'project'] },
      { __name: 'sections', __type: 'references', allowedTypes: ['block', 'pinned'] },
      { __name: 'deliverables', __type: 'references', allowedTypes: ['deliverable'] },
      { __name: 'projectTimeline', __type: 'references', allowedTypes: ['step'] },
    ],
  },
  {
    __name: 'post',
    label: 'Post',
    fields: [
      { __name: 'title', __type: 'text' },
      { __name: 'slug', __type: 'slug', from: 'title' },
      { __name: 'sections', __type: 'references', allowedTypes: ['block', 'pinned'] },
    ],
  },
  {
    __name: 'project',
    label: 'Project',
    fields: [
      { __name: 'title', __type: 'text' },
      { __name: 'deliverables', __type: 'references', allowedTypes: ['deliverable'] },
      { __name: 'projectTimeline', __type: 'references', allowedTypes: ['step'] },
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
  { __name: 'leaf', label: 'Leaf', fields: [{ __name: 'text', __type: 'text' }] },
  {
    __name: 'pinned',
    label: 'Pinned',
    fields: [{ __name: 'projects', __type: 'references', allowedTypes: ['project'] }],
  },
  { __name: 'button', label: 'Button', fields: [{ __name: 'label', __type: 'text' }] },
  {
    __name: 'deliverable',
    label: 'Deliverable',
    fields: [{ __name: 'title', __type: 'text' }],
  },
  { __name: 'step', label: 'Step', fields: [{ __name: 'title', __type: 'text' }] },
];

const ACTOR = 'test';
const SHARE = ['project', 'post', 'button'] as const;

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

/** A blog-shaped template: two sections, the first owning a leaf. */
async function makeBlogTemplate(adapter: Adapter) {
  const leaf = await adapter.create('leaf', { text: 'intro copy' }, ACTOR);
  const one = await adapter.create('block', { heading: 'One', child: leaf.__id }, ACTOR);
  const two = await adapter.create('block', { heading: 'Two' }, ACTOR);
  const template = await adapter.create(
    'template',
    { name: 'Standard article', kind: 'blog', sections: [one.__id, two.__id] },
    ACTOR
  );
  return { template, one, two, leaf };
}

describe('instantiateFrom', () => {
  it('creates the target Type, not a copy of the source', async () => {
    const adapter = await makeAdapter();
    const { template } = await makeBlogTemplate(adapter);

    const result = await instantiateFrom(template.__id, deps(adapter), {
      targetType: 'post',
      fieldMap: { sections: 'sections' },
      seedValues: { title: 'My new post' },
    });

    expect(result.type).toBe('post');
    expect(result.id).not.toBe(template.__id);

    const post = await read(adapter, 'post', result.id);
    expect(post?.title).toBe('My new post');
    expect((post?.sections as string[]).length).toBe(2);

    // The new entry really is a post, and carries none of the template's own fields.
    expect((post as Record<string, unknown>).kind).toBeUndefined();
  });

  it('deep-copies the sections so editing the new entry cannot touch the template', async () => {
    const adapter = await makeAdapter();
    const { template, one, two, leaf } = await makeBlogTemplate(adapter);

    const result = await instantiateFrom(template.__id, deps(adapter), {
      targetType: 'post',
      fieldMap: { sections: 'sections' },
      seedValues: { title: 'New' },
    });

    const post = await read(adapter, 'post', result.id);
    const copied = post?.sections as string[];

    expect(copied).not.toContain(one.__id);
    expect(copied).not.toContain(two.__id);

    // …and the grandchild is its own too.
    const firstCopy = await read(adapter, 'block', copied[0]);
    expect(firstCopy?.heading).toBe('One');
    expect(firstCopy?.child).not.toBe(leaf.__id);

    const leafCopy = await read(adapter, 'leaf', firstCopy?.child as string);
    expect(leafCopy?.text).toBe('intro copy');

    // root + 2 sections + 1 leaf
    expect(result.created).toBe(4);
  });

  it('leaves the template itself untouched', async () => {
    const adapter = await makeAdapter();
    const { template, one, two } = await makeBlogTemplate(adapter);

    await instantiateFrom(template.__id, deps(adapter), {
      targetType: 'post',
      fieldMap: { sections: 'sections' },
      seedValues: { title: 'New' },
    });

    const after = await read(adapter, 'template', template.__id);
    expect(after?.name).toBe('Standard article');
    expect(after?.sections).toEqual([one.__id, two.__id]);
  });

  it('shares the Types the caller names instead of copying them', async () => {
    const adapter = await makeAdapter();

    const project = await adapter.create('project', { title: 'Real case study' }, ACTOR);
    const button = await adapter.create('button', { label: 'Request a Quote' }, ACTOR);
    const pinned = await adapter.create('pinned', { projects: [project.__id] }, ACTOR);
    const block = await adapter.create('block', { heading: 'CTA', cta: button.__id }, ACTOR);
    const template = await adapter.create(
      'template',
      { name: 'With refs', kind: 'blog', sections: [pinned.__id, block.__id] },
      ACTOR
    );

    const result = await instantiateFrom(template.__id, deps(adapter), {
      targetType: 'post',
      fieldMap: { sections: 'sections' },
      seedValues: { title: 'New' },
      shareTypes: SHARE,
    });

    const post = await read(adapter, 'post', result.id);
    const [pinnedCopy, blockCopy] = post?.sections as string[];

    // The wrappers are copied…
    expect(pinnedCopy).not.toBe(pinned.__id);
    expect(blockCopy).not.toBe(block.__id);

    // …but what they point at is not.
    const pinnedRead = await read(adapter, 'pinned', pinnedCopy);
    expect(pinnedRead?.projects).toEqual([project.__id]);

    const blockRead = await read(adapter, 'block', blockCopy);
    expect(blockRead?.cta).toBe(button.__id);
  });

  it('maps several lists at once for a project-kind template', async () => {
    const adapter = await makeAdapter();

    const d1 = await adapter.create('deliverable', { title: 'Strip out' }, ACTOR);
    const d2 = await adapter.create('deliverable', { title: 'First fix' }, ACTOR);
    const s1 = await adapter.create('step', { title: 'Week 1' }, ACTOR);
    const template = await adapter.create(
      'template',
      {
        name: 'Standard case study',
        kind: 'project',
        deliverables: [d1.__id, d2.__id],
        projectTimeline: [s1.__id],
      },
      ACTOR
    );

    const result = await instantiateFrom(template.__id, deps(adapter), {
      targetType: 'project',
      fieldMap: { deliverables: 'deliverables', projectTimeline: 'projectTimeline' },
      seedValues: { title: 'New case study' },
      shareTypes: SHARE,
    });

    const project = await read(adapter, 'project', result.id);
    expect((project?.deliverables as string[]).length).toBe(2);
    expect((project?.projectTimeline as string[]).length).toBe(1);
    expect(project?.deliverables).not.toContain(d1.__id);

    const copied = await read(adapter, 'deliverable', (project?.deliverables as string[])[0]);
    expect(copied?.title).toBe('Strip out');

    // root + 2 deliverables + 1 step
    expect(result.created).toBe(4);
  });

  it('runs the other way too — an entry snapshotted into a template', async () => {
    const adapter = await makeAdapter();

    const leaf = await adapter.create('leaf', { text: 'body' }, ACTOR);
    const block = await adapter.create('block', { heading: 'Intro', child: leaf.__id }, ACTOR);
    const post = await adapter.create(
      'post',
      { title: 'A real post', slug: 'a-real-post', sections: [block.__id] },
      ACTOR
    );

    const result = await instantiateFrom(post.__id, deps(adapter), {
      targetType: 'template',
      fieldMap: { sections: 'sections' },
      seedValues: { name: 'From a real post', kind: 'blog' },
      shareTypes: SHARE,
    });

    const template = await read(adapter, 'template', result.id);
    expect(template?.name).toBe('From a real post');
    expect(template?.kind).toBe('blog');
    expect(template?.sections).not.toContain(block.__id);

    // The post's own identity does not leak into the template.
    expect((template as Record<string, unknown>).title).toBeUndefined();

    // …and the post is untouched.
    const postAfter = await read(adapter, 'post', post.__id);
    expect(postAfter?.sections).toEqual([block.__id]);
  });

  it('omits a list the source does not have rather than writing an empty one', async () => {
    const adapter = await makeAdapter();

    const template = await adapter.create(
      'template',
      { name: 'Empty', kind: 'project' },
      ACTOR
    );

    const result = await instantiateFrom(template.__id, deps(adapter), {
      targetType: 'project',
      fieldMap: { deliverables: 'deliverables', projectTimeline: 'projectTimeline' },
      seedValues: { title: 'Blank case study' },
    });

    const project = await read(adapter, 'project', result.id);
    expect(project?.title).toBe('Blank case study');
    expect(result.created).toBe(1);
  });

  it('seeded values win over anything the field map produced', async () => {
    const adapter = await makeAdapter();
    const { template } = await makeBlogTemplate(adapter);

    const result = await instantiateFrom(template.__id, deps(adapter), {
      targetType: 'post',
      fieldMap: { sections: 'sections' },
      seedValues: { title: 'Explicit', sections: [] },
    });

    const post = await read(adapter, 'post', result.id);
    expect(post?.sections).toEqual([]);
  });

  it('refuses to run away past maxEntries', async () => {
    const adapter = await makeAdapter();

    const leaf = await adapter.create('leaf', { text: 'x' }, ACTOR);
    const blocks: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const block = await adapter.create(
        'block',
        { heading: `b${i}`, child: leaf.__id },
        ACTOR
      );
      blocks.push(block.__id);
    }
    const template = await adapter.create(
      'template',
      { name: 'Big', kind: 'blog', sections: blocks },
      ACTOR
    );

    await expect(
      instantiateFrom(template.__id, deps(adapter), {
        targetType: 'post',
        fieldMap: { sections: 'sections' },
        maxEntries: 3,
      })
    ).rejects.toThrow(/refusing to copy more than 3/);
  });

  it('throws on a source id that resolves to nothing', async () => {
    const adapter = await makeAdapter();

    await expect(
      instantiateFrom('does-not-exist', deps(adapter), {
        targetType: 'post',
        fieldMap: { sections: 'sections' },
      })
    ).rejects.toThrow(/no entry found/);
  });

  it('throws on a target Type the schema does not have', async () => {
    const adapter = await makeAdapter();
    const { template } = await makeBlogTemplate(adapter);

    await expect(
      instantiateFrom(template.__id, deps(adapter), {
        targetType: 'not-a-type',
        fieldMap: { sections: 'sections' },
      })
    ).rejects.toThrow(/no "not-a-type" Type/);
  });
});
