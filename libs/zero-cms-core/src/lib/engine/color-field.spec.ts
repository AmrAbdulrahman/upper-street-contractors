import { describe, it, expect } from 'vitest';
import type { Schema } from '../model/schema';
import { createNodeAdapter, createMemoryStoragePort } from '../../node';

/**
 * The `color` field kind. Its whole reason for existing over a `text` field is
 * that the value has a shape, so the shape is what these lock down.
 */
const schema: Schema = [
  {
    __name: 'badge',
    label: 'Badge',
    fields: [
      { __name: 'title', __type: 'text' },
      { __name: 'glow', __type: 'color', presets: ['#c8a253'] },
    ],
  },
];

async function makeAdapter() {
  return createNodeAdapter(createMemoryStoragePort({ schema }));
}

async function read(adapter: Awaited<ReturnType<typeof makeAdapter>>, id: string) {
  return adapter.get('badge', id, { status: 'draft', includeUnpublished: true });
}

describe('color field', () => {
  it.each(['#fff', '#c8a253', '#C8A253', '#c8a25380'])('accepts %s', async (value) => {
    const adapter = await makeAdapter();
    const created = await adapter.create('badge', { title: 'x', glow: value }, 'test');
    expect((await read(adapter, created.__id))?.glow).toBe(value);
  });

  it.each(['red', 'rgb(1,2,3)', '#ff', '#12345', 'c8a253', '#gggggg'])(
    'rejects %s on write',
    async (value) => {
      const adapter = await makeAdapter();
      // Rejected at create, not deferred to publish: a malformed colour is a
      // broken style rather than an incomplete value — the same argument `slug`
      // makes for validating a URL segment on every write.
      const error = await adapter
        .create('badge', { title: 'x', glow: value }, 'test')
        .then(
          () => null,
          (e) => e as { code?: string; details?: Array<{ field: string; message: string }> }
        );

      expect(error).not.toBeNull();
      expect(error?.code).toBe('VALIDATION');
      // The issue must name the offending field, not just say "invalid" — the
      // drawer surfaces these per field.
      expect(error?.details).toContainEqual(
        expect.objectContaining({
          field: 'glow',
          message: expect.stringMatching(/hex colour/i),
        })
      );
    }
  );

  it('treats an unset colour as absent, not as black', async () => {
    const adapter = await makeAdapter();
    const created = await adapter.create('badge', { title: 'x' }, 'test');
    const published = await adapter.publish('badge', created.__id, 'test', created.__lastEditedAt);
    // An optional colour left alone must stay empty — a picker that reports
    // #000000 for "untouched" would otherwise write black everywhere.
    expect(published.values?.['glow'] ?? null).toBeNull();
  });

  it('surfaces as a filterable String in GraphQL, not a custom scalar', async () => {
    const { generateSdl } = await import('@usc/zero-cms-graphql');
    const sdl = generateSdl(schema);
    expect(sdl).toMatch(/glow: String/);
    expect(sdl).toMatch(/glow: StringFilter/);
  });
});
