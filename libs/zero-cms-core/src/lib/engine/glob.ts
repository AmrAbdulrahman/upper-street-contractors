/**
 * Tiny dependency-free glob (node only). Supports `*`, `?`, and `**` against a
 * directory tree. Enough for type-file patterns like `types/**\/*.json` or
 * `src/**\/*.type.json`. Returns absolute paths.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:[^/]+/)*'; // **/  → zero or more path segments
        } else {
          re += '.*'; // **
        }
      } else {
        re += '[^/]*'; // *
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('\\^$+.()|{}[]'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

export async function globFiles(pattern: string, cwd: string): Promise<string[]> {
  const re = globToRegExp(pattern);
  let entries: string[];
  try {
    entries = await readdir(cwd, { recursive: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const out: string[] = [];
  for (const entry of entries) {
    const rel = entry.split(/[\\/]/).join('/');
    if (re.test(rel)) out.push(join(cwd, entry));
  }
  return out;
}
