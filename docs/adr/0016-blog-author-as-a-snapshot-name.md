# 16. Blog Post author is a snapshot name, not a link to a CMS user

Date: 2026-07-26

## Status

Accepted

## Context

A Blog Post's byline should name one of the real people who sign into the CMS. It
originally pointed at a bespoke `author` content Type — a second, parallel list of
people that an editor had to maintain by hand and keep in step with the actual
accounts.

The obvious replacement is a reference to the CMS user. It does not fit the way
zero-cms is built:

- **Users are not Entries.** They live in `users.json` behind the auth service, not
  in the entry store, so nothing in the GraphQL schema can resolve one. A stored
  user id on a post is opaque to every reader of that post.
- **The post is public.** Rendering `By <name>` for an anonymous visitor would mean
  a **public** read path over the accounts file. Even scoped to name and photo,
  that is a new externally-reachable surface over the file that also holds emails,
  roles, password hashes and disabled flags — added purely to print a byline.
- **Even the picker needed a new door.** `listUsers` is admin-only, but a Copy
  writer has to be able to choose an author.

## Decision

**`author` stores the chosen CMS user's display name as text** — a new first-class
`user` field kind whose editor is a dropdown of the current accounts, and whose
stored value is a name.

The one new server capability is `listAuthors`: open to any signed-in Role,
returning `{ id, name }` for enabled accounts only. It is a deliberate projection
(`toAuthorOption`), not a `SafeUser` — email, role and account state never leave
the admin surface. Nothing anonymous reads accounts at all; the public page just
renders a string that was already on the post.

A `user` kind rather than a plain `text` field with a special editor, because the
behaviour belongs to the kind: the Type builder offers it, GraphQL still sees
`String`, and the next Type that needs a person gets it for free.

## Consequences

**Good**

- No public read path over `users.json`, and no new anonymous surface of any kind.
- The public page renders the byline with no resolver, no join and no auth.
- The parallel `author` content Type is gone from a post's shape — one list of
  people, and it is the one people actually log into.

**Bad / accepted costs**

- **A rename does not propagate.** Change a CMS user's name and older posts keep
  crediting the old one. Accepted: a byline records who wrote it *then*, and
  back-dating credits is closer to wrong than to helpful. If it ever needs to
  propagate, that is a migration over posts, not a schema change.
- **A departed author's name is still on their posts** — which is correct, and why
  the `user` kind deliberately does **not** validate its value against the current
  user list. The editor keeps offering the stored name as an option so re-saving a
  post cannot quietly blank it.
- **The `author` Type still exists**, because `project.author` still declares it.
  Nothing on the site renders it; removing it means a second schema edit plus
  clearing any stored `project.author` values.
- **Two people with the same display name are indistinguishable** on a post. There
  are three CMS users.

## Alternatives considered

- **Store the user id + a public `cmsUser(id)` resolver.** Live: rename a user and
  every post follows. Rejected for the new public surface over the accounts file,
  which is a permanent security consideration traded for a cosmetic gain.
- **Keep the `author` content Type.** No new field kind, no new RPC — and the
  standing problem that the list of authors and the list of accounts are two
  different things that drift.
- **Derive the author from the entry's `__lastEditedBy`.** Free, and wrong: that is
  whoever last touched a typo, not who wrote the piece.
