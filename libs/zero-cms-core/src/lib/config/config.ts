/**
 * zero-cms configuration (node-only) — local dev / tests only, the fs-backed
 * adapter's config. The deployed reference server is Redis/Blob-backed (ADR 0008)
 * and doesn't use this at all.
 *
 * A `zero-cms.config.mjs` (or `.js`) exports a {@link ZeroCmsUserConfig}. Paths are
 * resolved relative to the config file's directory; `dir` defaults to that directory.
 *
 *   // zero-cms.config.mjs
 *   export default {
 *     dir: '.zero-cms-store',        // base dir (types.json, data/, users/, media/)
 *     generated: 'generated',        // where the typed client is emitted
 *   };
 */

import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { access } from 'node:fs/promises';

export interface ZeroCmsUserConfig {
  /** Base directory. Default: the config file's directory. */
  dir?: string;
  /** Output directory for the generated typed client. Default: `<dir>/generated`. */
  generated?: string;
}

/** Fully-resolved, absolute configuration used by the engine + tooling. */
export interface ZeroCmsConfig {
  dir: string;
  generated: string;
  /** `<dir>/media` — blob-store root for the fs-backed `BlobStore`. */
  mediaDir: string;
}

export const DEFAULT_CONFIG: Required<Omit<ZeroCmsUserConfig, 'dir'>> = {
  generated: 'generated',
};

export function resolveConfig(
  user: ZeroCmsUserConfig,
  configDir: string
): ZeroCmsConfig {
  const dir = resolve(configDir, user.dir ?? '.');
  return {
    dir,
    generated: resolve(dir, user.generated ?? DEFAULT_CONFIG.generated),
    mediaDir: join(dir, 'media'),
  };
}

const CONFIG_NAMES = ['zero-cms.config.mjs', 'zero-cms.config.js'];

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Find the nearest `zero-cms.config.*`, walking up from `from` (default cwd). */
export async function findConfigFile(from = process.cwd()): Promise<string | null> {
  let dir = isAbsolute(from) ? from : resolve(process.cwd(), from);
  for (let i = 0; i < 8; i++) {
    for (const name of CONFIG_NAMES) {
      const candidate = join(dir, name);
      if (await exists(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Load and resolve config. If `fileOrDir` is a config file it's used directly;
 * otherwise we search upward from it (or cwd). Throws if none is found.
 */
export async function loadConfig(fileOrDir?: string): Promise<ZeroCmsConfig> {
  let file: string | null = null;
  if (fileOrDir && /zero-cms\.config\.(mjs|js)$/.test(fileOrDir)) {
    file = resolve(fileOrDir);
  } else {
    file = await findConfigFile(fileOrDir);
  }
  if (!file) {
    throw new Error(
      'zero-cms: no zero-cms.config.mjs found (searched up from ' +
        (fileOrDir ?? process.cwd()) +
        ')'
    );
  }
  // Magic comments keep bundlers (turbopack/webpack) from trying to statically
  // resolve this runtime import of the user's config file.
  const mod = (await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ pathToFileURL(file).href
  )) as {
    default?: ZeroCmsUserConfig;
  };
  const user = mod.default ?? {};
  return resolveConfig(user, dirname(file));
}
