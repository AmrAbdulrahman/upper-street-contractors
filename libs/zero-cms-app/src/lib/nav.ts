/** Internal navigation state — pure React state, no router (env-independent). */

export type Section = 'types' | 'entries' | 'media' | 'users';

export type View =
  | { section: 'types' }
  | { section: 'types'; typeName: string } // editing a Type
  | { section: 'entries'; typeName?: string; entryId?: string }
  | { section: 'media' }
  | { section: 'users' };

/** `users` is admin-only — the chrome filters it out for other roles. */
export const SECTIONS: { id: Section; label: string }[] = [
  { id: 'entries', label: 'Content' },
  { id: 'types', label: 'Types' },
  { id: 'media', label: 'Media' },
  { id: 'users', label: 'Users' },
];
