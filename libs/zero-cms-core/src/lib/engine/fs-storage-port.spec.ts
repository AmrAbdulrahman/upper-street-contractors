import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFsStoragePort, createFsBlobStore } from './fs-storage-port';
import { resolveConfig } from '../config/config';
import type { Type } from '../model/schema';
import type { Entry } from '../model/entry';

const author: Type = { __name: 'author', fields: [{ __name: 'name', __type: 'text' }] };
const tag: Type = { __name: 'tag', fields: [{ __name: 'label', __type: 'text' }] };

function makeEntry(type: string, id: string, values: Record<string, unknown>): Entry {
  const now = new Date().toISOString();
  return {
    __id: id,
    __type: type,
    __status: 'unpublished',
    values: null,
    __draft: values,
    __createdAt: now,
    __lastEditedAt: now,
    __lastEditedBy: 'tester',
  };
}

describe('fs storage port (per-record files, ADR 0008/0009)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'zcms-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('schema is a single-document CAS — null until first save, then round-trips', async () => {
    const port = createFsStoragePort(resolveConfig({}, dir));
    expect(await port.readSchema()).toBeNull();

    const written = await port.writeSchema([author], null);
    expect(written?.schema).toEqual([author]);

    const read = await port.readSchema();
    expect(read?.schema).toEqual([author]);

    // Stale expectedVersion is rejected.
    expect(await port.writeSchema([author, tag], 'not-the-real-version')).toBeNull();

    const second = await port.writeSchema([author, tag], read?.version ?? null);
    expect(second?.schema.map((t) => t.__name).sort()).toEqual(['author', 'tag']);
  });

  it('entries: create has no CAS, update/delete enforce it', async () => {
    const port = createFsStoragePort(resolveConfig({}, dir));
    const entry = makeEntry('author', 'e1', { name: 'Jo' });
    await port.createEntry(entry);

    expect(await port.readEntry('e1')).toMatchObject({ __id: 'e1' });
    expect(await port.listEntryIds('author')).toEqual(['e1']);
    expect(await port.readEntries(['e1'])).toHaveLength(1);

    const next = { ...entry, __draft: { name: 'Jo 2' }, __lastEditedAt: 'T2' };
    expect(await port.writeEntry('e1', 'wrong-expected-timestamp', next)).toBe(false);
    expect(await port.writeEntry('e1', entry.__lastEditedAt, next)).toBe(true);
    expect((await port.readEntry('e1'))?.__lastEditedAt).toBe('T2');

    expect(await port.deleteEntry('e1', 'stale')).toBe(false);
    expect(await port.deleteEntry('e1', 'T2')).toBe(true);
    expect(await port.readEntry('e1')).toBeNull();
  });

  it('media: blob store put/get/delete + metadata CAS', async () => {
    const port = createFsStoragePort(resolveConfig({}, dir));
    const blobs = createFsBlobStore(resolveConfig({}, dir));

    const { url } = await blobs.put('media/m1/hero.png', new Uint8Array([1, 2, 3]), 'image/png');
    expect(await blobs.get(url)).toEqual(new Uint8Array([1, 2, 3]));

    const now = new Date().toISOString();
    await port.createMediaItem({
      id: 'm1',
      filename: 'hero.png',
      url,
      mime: 'image/png',
      size: 3,
      kind: 'image',
      createdAt: now,
      updatedAt: now,
      lastEditedBy: 'tester',
    });
    expect(await port.listMediaIds()).toEqual(['m1']);

    const item = await port.readMediaItem('m1');
    expect(item?.url).toBe(url);

    expect(
      await port.writeMediaItem('m1', 'stale', { ...item!, alternativeText: 'Hero' })
    ).toBe(false);
    expect(
      await port.writeMediaItem('m1', now, { ...item!, alternativeText: 'Hero', updatedAt: 'T2' })
    ).toBe(true);

    await blobs.delete(url);
    await expect(blobs.get(url)).rejects.toThrow();
  });
});
