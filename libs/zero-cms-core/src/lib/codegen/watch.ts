/**
 * Watch the type files and regenerate the client on change (node only).
 * Uses node's built-in `fs.watch` (no extra dependency) with debounce.
 */

import { watch } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename } from 'node:path';
import { generateFromConfig, type GenerateOptions } from './write';
import { loadConfig, resolveConfig, type ZeroCmsConfig } from '../config/config';

export interface WatchHandle {
  close(): void;
}

export interface WatchOptions extends GenerateOptions {
  /** Debounce window in ms. Default 100. */
  debounceMs?: number;
  onGenerate?: (file: string) => void;
  onError?: (err: unknown) => void;
}

async function watchConfig(
  config: ZeroCmsConfig,
  opts: WatchOptions
): Promise<WatchHandle> {
  const debounceMs = opts.debounceMs ?? 100;
  let timer: NodeJS.Timeout | undefined;

  const regen = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      generateFromConfig(config, opts)
        .then((out) => opts.onGenerate?.(out))
        .catch((err) => opts.onError?.(err));
    }, debounceMs);
  };

  await generateFromConfig(config, opts)
    .then((out) => opts.onGenerate?.(out))
    .catch((err) => opts.onError?.(err));

  await mkdir(config.typesDir, { recursive: true });
  const watchers = [
    watch(config.typesDir, { persistent: true, recursive: true }, regen),
    // legacy single-file types.json lives directly under dir
    watch(config.dir, { persistent: true }, (_e, file) => {
      if (file && basename(file) === 'types.json') regen();
    }),
  ];

  return {
    close() {
      clearTimeout(timer);
      for (const w of watchers) w.close();
    },
  };
}

/** Watch a base directory (default config) or a resolved config. */
export async function watchSchema(
  target: string | ZeroCmsConfig,
  opts: WatchOptions = {}
): Promise<WatchHandle> {
  const config = typeof target === 'string' ? resolveConfig({}, target) : target;
  return watchConfig(config, opts);
}

/** Load `zero-cms.config.*` (searching up from `from`) and watch. */
export async function watchFromConfig(
  from?: string,
  opts: WatchOptions = {}
): Promise<WatchHandle> {
  return watchConfig(await loadConfig(from), opts);
}
