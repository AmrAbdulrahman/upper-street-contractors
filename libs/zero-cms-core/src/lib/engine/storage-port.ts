/**
 * StoragePort — the low-level persistence boundary the Engine writes through.
 *
 * The Engine holds all CMS logic; the port only reads/writes bytes. The fs
 * implementation (node) does atomic temp-file + rename writes. This keeps the
 * Engine itself storage-agnostic and testable with an in-memory port.
 */

import type { Schema } from '../model/schema';
import type { Entry } from '../model/entry';
import type { MediaItem } from '../model/media';
import type { User } from '../model/user';

export interface StoragePort {
  /** `null` when the file does not exist yet (fresh base directory). */
  readSchema(): Promise<Schema | null>;
  writeSchema(schema: Schema): Promise<void>;

  readData(): Promise<Entry[] | null>;
  writeData(entries: Entry[]): Promise<void>;

  /** Users (`users.json`). `null`/empty when none exist yet. */
  readUsers(): Promise<User[] | null>;
  writeUsers(users: User[]): Promise<void>;

  /** `media/index.json`. Empty array when absent. */
  readMediaIndex(): Promise<MediaItem[]>;
  writeMediaIndex(items: MediaItem[]): Promise<void>;

  writeMediaFile(filename: string, bytes: Uint8Array): Promise<void>;
  readMediaFile(filename: string): Promise<Uint8Array>;
  deleteMediaFile(filename: string): Promise<void>;
}
