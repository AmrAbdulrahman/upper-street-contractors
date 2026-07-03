import { describe, it, expect } from 'vitest';
import { graphql } from 'graphql';
import { createNodeAdapter, createMemoryStoragePort } from '@usc/zero-cms-core/node';
import type { Schema } from '@usc/zero-cms-core';
import { buildCmsSchema } from './schema';
import { generateSdl } from './sdl';

const schema: Schema = [
  { __name: 'author', label: 'Author', fields: [{ __name: 'name', __type: 'text', required: true }] },
  {
    __name: 'project',
    label: 'Project',
    fields: [
      { __name: 'title', __type: 'text', required: true },
      { __name: 'category', __type: 'lookup', options: ['Bathroom', 'Loft'] },
      { __name: 'author', __type: 'reference', allowedTypes: ['author'] },
    ],
  },
];

async function setup() {
  const adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
  const gql = buildCmsSchema({ schema, adapter });
  const exec = (source: string, variableValues?: Record<string, unknown>) =>
    graphql({ schema: gql, source, variableValues });
  return { adapter, exec };
}

describe('generateSdl', () => {
  it('emits Strapi-shaped Query/Mutation, enum and reference field', () => {
    const sdl = generateSdl(schema);
    expect(sdl).toContain('type Project {');
    expect(sdl).toContain('author: Author'); // single-target reference -> object type
    expect(sdl).toContain('enum ProjectCategory { Bathroom Loft }');
    expect(sdl).toContain('projects(filters: ProjectFilters, pagination: Pagination');
    expect(sdl).toContain('): [Project!]!'); // flat array, not a Page wrapper
    expect(sdl).toContain('createProject(values: ProjectInput!): Project!');
  });
});

describe('graphql execution', () => {
  it('queries a list with where filter + resolves a nested reference', async () => {
    const { adapter, exec } = await setup();
    const a = await adapter.create('author', { name: 'Jo' });
    await adapter.publish('author', a.__id);
    const p = await adapter.create('project', {
      title: 'Loft job',
      category: 'Loft',
      author: a.__id,
    });
    await adapter.publish('project', p.__id);

    const res = await exec(`{
      projects(filters: { category: { eq: "Loft" } }) {
        id title status category author { id name }
      }
    }`);

    expect(res.errors).toBeUndefined();
    const data = res.data as { projects: Array<Record<string, unknown>> };
    expect(data.projects).toHaveLength(1);
    const row = data.projects[0];
    expect(row.title).toBe('Loft job');
    expect(row.status).toBe('published');
    expect((row.author as { name: string }).name).toBe('Jo'); // nested resolved
  });

  it('resolves new field types: asset->Media, number, json, blocks', async () => {
    const mediaSchema: Schema = [
      {
        __name: 'card',
        fields: [
          { __name: 'title', __type: 'text', required: true },
          { __name: 'order', __type: 'number', integer: true },
          { __name: 'hero', __type: 'asset', accept: 'image' },
          { __name: 'body', __type: 'blocks' },
          { __name: 'extra', __type: 'json' },
        ],
      },
    ];
    const adapter = await createNodeAdapter(createMemoryStoragePort({ schema: mediaSchema }));
    const gql = buildCmsSchema({ schema: mediaSchema, adapter });
    const m = await adapter.putMedia(new Uint8Array([1, 2, 3]), {
      filename: 'h.png',
      mime: 'image/png',
      width: 800,
      height: 600,
      alternativeText: 'Hero alt',
    });
    const c = await adapter.create('card', {
      title: 'C',
      order: 3,
      hero: m.id,
      body: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hi' }] }],
      extra: { a: 1, b: ['x'] },
    });

    const res = await graphql({
      schema: gql,
      source: `query($id: ID!) {
        card(id: $id, status: draft) {
          title order extra body
          hero { id url alt width height mime kind }
        }
      }`,
      variableValues: { id: c.__id },
    });
    expect(res.errors).toBeUndefined();
    const card = (res.data as { card: Record<string, unknown> }).card;
    expect(card.order).toBe(3);
    expect(card.extra).toEqual({ a: 1, b: ['x'] });
    expect(Array.isArray(card.body)).toBe(true);
    expect(card.hero).toMatchObject({
      id: m.id,
      url: `/api/cms/media/${m.id}`,
      alt: 'Hero alt',
      width: 800,
      height: 600,
      mime: 'image/png',
      kind: 'image',
    });
  });

  it('enforces auth: anonymous reads clamp to published, mutations need editor', async () => {
    const adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
    const gql = buildCmsSchema({ schema, adapter });
    const draft = await adapter.create('author', { name: 'Hidden' }); // unpublished draft
    void draft;

    const anon = { authEnabled: true, session: null };
    // Anonymous draft read is clamped to published -> sees nothing.
    const read = await graphql({
      schema: gql,
      source: `{ authors(status: draft, includeUnpublished: true) { id } }`,
      contextValue: anon,
    });
    expect((read.data as { authors: unknown[] }).authors).toHaveLength(0);

    // Anonymous mutation is rejected.
    const denied = await graphql({
      schema: gql,
      source: `mutation { createAuthor(values: { name: "X" }) { id } }`,
      contextValue: anon,
    });
    expect(denied.errors?.[0].message).toMatch(/sign in/i);

    // Editor session may mutate.
    const editor = {
      authEnabled: true,
      session: { userId: 'u1', email: 'e@x', role: 'editor', forcePasswordUpdate: false },
    };
    const ok = await graphql({
      schema: gql,
      source: `mutation { createAuthor(values: { name: "X" }) { id status } }`,
      contextValue: editor,
    });
    expect(ok.errors).toBeUndefined();
  });

  it('creates + publishes through mutations', async () => {
    const { exec } = await setup();
    const created = await exec(`mutation {
      createAuthor(values: { name: "Mara" }) { id status hasDraft }
    }`);
    expect(created.errors).toBeUndefined();
    const id = (created.data as { createAuthor: { id: string } }).createAuthor.id;

    const published = await exec(
      `mutation ($id: ID!) { publishAuthor(id: $id) { status hasDraft } }`,
      { id }
    );
    expect(published.errors).toBeUndefined();
    expect(
      (published.data as { publishAuthor: { status: string; hasDraft: boolean } })
        .publishAuthor
    ).toEqual({ status: 'published', hasDraft: false });
  });
});
