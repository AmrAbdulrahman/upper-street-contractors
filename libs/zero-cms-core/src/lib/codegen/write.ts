/** Write the generated client to disk (node only). */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Schema } from '../model/schema';
import { createFsStoragePort } from '../engine/fs-storage-port';
import {
  loadConfig,
  resolveConfig,
  type ZeroCmsConfig,
} from '../config/config';
import { generateClientSource } from './generate';

export interface GenerateOptions {
  /** Override the output directory (defaults to the config's `generated`). */
  outDir?: string;
  /** Generated file name. Default `index.ts`. */
  fileName?: string;
}

/** Read the (multi-file) schema for a config and emit the typed client. */
export async function generateFromConfig(
  config: ZeroCmsConfig,
  opts: GenerateOptions = {}
): Promise<string> {
  const schema = (await createFsStoragePort(config).readSchema()) ?? [];
  return writeGeneratedClient(schema, opts.outDir ?? config.generated, opts.fileName);
}

/** Load `zero-cms.config.*` (searching up from `from`) and generate. */
export async function generate(
  from?: string,
  opts: GenerateOptions = {}
): Promise<string> {
  return generateFromConfig(await loadConfig(from), opts);
}

/** Generate from a base directory using default config. */
export async function generateFromDir(
  baseDir: string,
  opts: GenerateOptions = {}
): Promise<string> {
  return generateFromConfig(resolveConfig({}, baseDir), opts);
}

/** Emit the typed client for a schema. Returns the written file path. */
export async function writeGeneratedClient(
  schema: Schema,
  outDir: string,
  fileName = 'index.ts'
): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const file = join(outDir, fileName);
  await writeFile(file, generateClientSource(schema));
  return file;
}
