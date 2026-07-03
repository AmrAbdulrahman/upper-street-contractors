import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFsStoragePort } from './fs-storage-port';
import { resolveConfig } from '../config/config';
import type { Type } from '../model/schema';

const author: Type = { __name: 'author', fields: [{ __name: 'name', __type: 'text' }] };
const tag: Type = { __name: 'tag', fields: [{ __name: 'label', __type: 'text' }] };

const exists = (p: string) =>
  access(p).then(
    () => true,
    () => false
  );

describe('fs storage port (multi-file types)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'zcms-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads legacy types.json + per-type glob files merged', async () => {
    await writeFile(join(dir, 'types.json'), JSON.stringify([author]));
    await mkdir(join(dir, 'types'), { recursive: true });
    await writeFile(join(dir, 'types', 'tag.json'), JSON.stringify(tag));

    const port = createFsStoragePort(resolveConfig({}, dir));
    const schema = await port.readSchema();
    expect(schema?.map((t) => t.__name).sort()).toEqual(['author', 'tag']);
  });

  it('migrates legacy + writes new types as per-type files, deletes types.json', async () => {
    await writeFile(join(dir, 'types.json'), JSON.stringify([author]));
    const port = createFsStoragePort(resolveConfig({}, dir));
    const schema = (await port.readSchema()) ?? [];

    const note: Type = { __name: 'note', fields: [{ __name: 'body', __type: 'text' }] };
    await port.writeSchema([...schema, note]);

    expect(await exists(join(dir, 'types', 'author.json'))).toBe(true);
    expect(await exists(join(dir, 'types', 'note.json'))).toBe(true);
    expect(await exists(join(dir, 'types.json'))).toBe(false); // migrated away

    const authorFile = JSON.parse(
      await readFile(join(dir, 'types', 'author.json'), 'utf8')
    );
    expect(authorFile.__name).toBe('author'); // single Type object, not array
  });

  it('writes per-type files back in place and removes deleted types', async () => {
    await mkdir(join(dir, 'types'), { recursive: true });
    await writeFile(join(dir, 'types', 'author.json'), JSON.stringify(author));
    await writeFile(join(dir, 'types', 'tag.json'), JSON.stringify(tag));

    const port = createFsStoragePort(resolveConfig({}, dir));
    await port.readSchema();
    await port.writeSchema([author]); // drop tag

    expect(await exists(join(dir, 'types', 'author.json'))).toBe(true);
    expect(await exists(join(dir, 'types', 'tag.json'))).toBe(false);
  });
});
