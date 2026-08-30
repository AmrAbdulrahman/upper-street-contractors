# 17. Duplicate deep-copies, and the caller names what to share

Date: 2026-08-29

## Status

Accepted

## Context

"Start a new post from an existing one" was asked for as a template feature.
There was nothing to build on: the 20-op RPC protocol
(`libs/zero-cms-core/src/lib/adapter/protocol.ts`) has no duplicate, and the
nearest existing behaviour — the Type picker's **reuse** step — is the opposite
of a copy. It links the *same* Entry into a second place and says so in the UI:
"A reused {label} is the same content in both places."

That is exactly the trap. A Blog Post's content **is** its `sections`, an
ordered array of Entry ids. The obvious implementation — copy the post's own
field values — produces a second post pointing at the first one's sections. It
looks right in the index and in the drawer, and the first edit to the copy
rewrites the original. Nothing warns anyone, because at the data layer nothing
is wrong.

So the real question was not "shallow or deep" but **where the copy stops**. A
naive deep copy is just as wrong in the other direction: a Recent Work section
holds a `references` list of Projects, and recursing through it would mint
duplicate case studies that have their own `/projects/:id` pages, appear in the
sitemap, and shadow the real ones. The same goes for Buttons — every CTA band on
the site deliberately points at the *same* two Button entries so that changing
"Request a Quote" once changes it everywhere.

## Decision

**Deep-copy by default; the caller names the Types to share.**

1. **Deep.** `duplicateEntry` walks `reference` and `references` fields
   depth-first and creates a new Entry for each. The copy is independent all the
   way down, which is the only reading of "duplicate" that cannot silently
   corrupt the original.

2. **`shareTypes` is a parameter, not a heuristic.** The library has no way to
   know that a Project is standalone and a Figure is owned — that is a fact about
   *this* content model. `libs/zero-cms-widget` stays generic; the website passes
   `['project', 'blog-post', 'page', 'button', 'icon']` from the Blog index.

3. **Media is shared.** An `asset` field holds a media id and is copied by value
   like any other non-reference field. A second upload of identical bytes is a
   second thing to replace when the logo changes.

4. **No new RPC op.** It composes `locate`, `get` and `create`, all of which
   already exist and are already authorized. Adding a `duplicate` op would mean a
   protocol entry, an `authorize` entry, and an engine implementation, to express
   something the client can already say.

5. **Copies are drafts.** Created, never published, so an editor renames a post
   before anyone can read it.

6. **The root is special.** `slug` is cleared and `title` gains a suffix — on the
   root only. zero-cms enforces no slug uniqueness, so a copied slug silently
   shadows the original: the route takes the first match (see **Slug** in
   `CONTEXT.md`). Cleared, it re-derives from the new title.

## Consequences

**Good**

- The copy is genuinely independent, which is the entire user-visible promise.
- `shareTypes` makes the boundary explicit and reviewable. The list is
  three lines of documented reasoning at the call site rather than a rule buried
  in a traversal.
- Pure logic over an injected adapter and schema, so it is exercised against a
  real in-memory Engine (`createMemoryStoragePort`) rather than mocks —
  which matters more than usual, because `libs/` does not hot-reload under
  `next dev` and the browser is not a fast way to find out it is wrong.
- Any Type gets it: the widget context exposes `duplicate(id, opts)`, and the
  Blog index is simply its first caller. The trigger has since moved onto the
  entry’s own hover cluster (`DuplicateActionProvider`), and that changes
  nothing here: the host still supplies `shareTypes`, because the provider
  carries the options rather than the library guessing them.

**Bad / accepted costs**

- **N creates per duplicate.** A post with ten sections and their children is
  ~20 round trips. Accepted: duplication is an occasional, deliberate editor
  action, not a hot path. `maxEntries` (default 500) turns a runaway reference
  chain into an error instead of a slow disaster.
- **A shared Button stops tracking site-wide edits — unless it is shared.** This
  is why `button` is in the list, and it is a genuine judgement call rather than
  a fact: an editor who wants a post-specific CTA now has to detach it by hand.
- **The share list can go stale.** A new standalone Type added later will be
  deep-copied until someone adds it. There is no compile-time link between the
  schema and that array, and building one would mean a flag in the schema that
  every Type author has to reason about.
- **Cycles are closed by sharing the original.** `A → B → A` cannot be copied
  into a self-contained pair without a two-phase create-then-patch pass, which
  doubles the writes for every duplicate to handle a shape this content model
  does not produce. Instead, re-entering an in-flight Entry returns the original
  id and the result reports it, so the editor is told rather than silently given
  a half-shared copy. `references` cycles are pathological here; the tree-shaped
  content this runs on has none.
- **Rejected: a `duplicate` RPC op** in the engine. It would be one round trip
  instead of N, and could be transactional. But it would have to encode the
  owned-vs-shared boundary *inside* zero-cms, which is precisely the knowledge
  the engine does not have and the host does — see decision 2.
- **Rejected: shallow copy with a warning.** The Type picker already proves
  editors read "this is shared" and proceed anyway when the UI still looks
  correct afterwards. A warning does not undo a rewritten post.
