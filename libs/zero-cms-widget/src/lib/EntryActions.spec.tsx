import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  createNodeAdapter,
  createMemoryStoragePort,
  createMemoryBlobStore,
} from '@usc/zero-cms-core/node';
import type { Adapter, Schema } from '@usc/zero-cms-core';
import { ZeroCmsWidget } from './ZeroCmsWidget';
import { ZeroCmsEntry } from './inspect/ZeroCmsEntry';
import { ZeroCmsEntryProvider } from './inspect/entry-context';
import { ZeroCmsEntryActions } from './inspect/ZeroCmsEntryActions';
import { DeleteActionProvider } from './inspect/delete-action-context';

/**
 * The two affordances a page-shaped entry has that a section does not: the
 * actions row at the top of the page it IS, and a delete on its card's cluster
 * (a Project is queried by Type, so there is no parent to unlink it from).
 */

const schema: Schema = [
  {
    __name: 'prose',
    label: 'Rich Text',
    fields: [{ __name: 'title', __type: 'text' }],
  },
  {
    __name: 'post',
    label: 'Post',
    titleField: 'title',
    fields: [
      { __name: 'title', __type: 'text' },
      { __name: 'sections', __type: 'references', allowedTypes: ['prose'] },
    ],
  },
  {
    __name: 'template',
    label: 'Template',
    titleField: 'name',
    fields: [
      { __name: 'name', __type: 'text' },
      { __name: 'kind', __type: 'lookup', options: ['blog'] },
      { __name: 'sections', __type: 'references', allowedTypes: ['prose'] },
    ],
  },
];

const ACTOR = 'spec';

type Fixture = { adapter: Adapter; postId: string; sectionId: string };

/** A published post with one section — the thing every action here acts on. */
async function fixture(): Promise<Fixture> {
  const adapter = await createNodeAdapter(
    createMemoryStoragePort({ schema }),
    createMemoryBlobStore()
  );
  const section = await adapter.create('prose', { title: 'Section one' }, ACTOR);
  await adapter.publish('prose', section.__id, ACTOR, section.__lastEditedAt);
  const post = await adapter.create(
    'post',
    { title: 'First post', sections: [section.__id] },
    ACTOR
  );
  await adapter.publish('post', post.__id, ACTOR, post.__lastEditedAt);
  return { adapter, postId: post.__id, sectionId: section.__id };
}

function Actions({
  fx,
  offer = true,
}: {
  fx: Fixture;
  /** Off = the default host, which names neither a copy policy nor a template shape. */
  offer?: boolean;
}) {
  return (
    <ZeroCmsWidget adapter={fx.adapter} inspect>
      <ZeroCmsEntryProvider entry={{ __id: fx.postId, __type: 'post' }}>
        <ZeroCmsEntryActions
          noun="post"
          duplicateOptions={offer ? { shareTypes: [], renameField: 'title' } : undefined}
          templateOptions={
            offer ? { kind: 'blog', fieldMap: { sections: 'sections' } } : undefined
          }
        />
      </ZeroCmsEntryProvider>
    </ZeroCmsWidget>
  );
}

describe('<ZeroCmsEntryActions> — the row on the page an entry IS', () => {
  it('offers Duplicate and Save as template only when the host names the options', async () => {
    const fx = await fixture();
    const { unmount } = render(<Actions fx={fx} offer={false} />);

    // The lifecycle three always show; ADR 0017/0019 keep the copy policy a
    // parameter, so without one there is nothing to offer.
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Duplicate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save as template' })).toBeNull();

    unmount();
    render(<Actions fx={fx} />);
    expect(await screen.findByRole('button', { name: 'Duplicate' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save as template' })).toBeTruthy();
  });

  it('duplicates the post deeply — a copy with sections of its own', async () => {
    const fx = await fixture();
    render(<Actions fx={fx} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Duplicate' }));

    await waitFor(async () => {
      const posts = await fx.adapter.query('post', {
        status: 'draft',
        includeUnpublished: true,
      });
      expect(posts.total).toBe(2);
    });

    const posts = await fx.adapter.query('post', {
      status: 'draft',
      includeUnpublished: true,
    });
    const copy = posts.data.find((p) => p.__id !== fx.postId)!;
    expect(copy.title).toBe('First post (copy)');
    // A copy pointing at the original's sections would let an edit to one
    // rewrite the other — the whole point of ADR 0017.
    expect(copy.sections).not.toContain(fx.sectionId);
    expect((copy.sections as string[]).length).toBe(1);
    // Copies are drafts, never published.
    expect(copy.__status).toBe('unpublished');
  });

  it('saves the post as a template of the host-named kind', async () => {
    const fx = await fixture();
    render(<Actions fx={fx} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save as template' }));

    await waitFor(async () => {
      const templates = await fx.adapter.query('template', {
        status: 'draft',
        includeUnpublished: true,
      });
      expect(templates.total).toBe(1);
    });

    const templates = await fx.adapter.query('template', {
      status: 'draft',
      includeUnpublished: true,
    });
    expect(templates.data[0].kind).toBe('blog');
    expect((templates.data[0].sections as string[]).length).toBe(1);
  });
});

function Card({ fx }: { fx: Fixture }) {
  return (
    <ZeroCmsWidget adapter={fx.adapter} inspect>
      <DeleteActionProvider value={{ noun: 'post', label: 'First post' }}>
        <ZeroCmsEntry entry={{ id: fx.postId, type: 'post' }}>
          <section>
            First post
            {/* Nested: its own cluster must not offer to delete the card it is
                drawn inside. */}
            <ZeroCmsEntry entry={{ id: fx.sectionId, type: 'prose' }}>
              <span>Section one</span>
            </ZeroCmsEntry>
          </section>
        </ZeroCmsEntry>
      </DeleteActionProvider>
    </ZeroCmsWidget>
  );
}

describe('delete action — a card for an entry that belongs to no page', () => {
  it('deletes the entry through an in-place confirm', async () => {
    const fx = await fixture();
    render(<Card fx={fx} />);

    const host = (await screen.findByText('First post')).closest('section');
    fireEvent.pointerEnter(host!);

    // The title is in the button's name, not the confirm's sentence: a grid of
    // cards would otherwise read "Delete post" once per card.
    fireEvent.click(await screen.findByRole('button', { name: 'Delete post “First post”' }));
    expect(await screen.findByRole('heading', { name: 'Delete post' })).toBeTruthy();
    // …and the sentence keeps its spaces around the noun (the JSX transform
    // eats the one leading a text chunk).
    expect(screen.getByText(/deletes the post and everything it holds/)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete this post' }));

    await waitFor(async () => {
      const entry = await fx.adapter.get('post', fx.postId, {
        status: 'draft',
        includeUnpublished: true,
      });
      expect(entry).toBeNull();
    });
  });

  it('does not leak the action onto a nested entry', async () => {
    const fx = await fixture();
    render(<Card fx={fx} />);

    const nested = (await screen.findByText('Section one')).closest('span');
    fireEvent.pointerEnter(nested!);

    // The nested entry gets its pencil and nothing else: deleting from here
    // would destroy the card this span is drawn inside.
    expect(await screen.findByRole('button', { name: /^Edit entry/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Delete post/ })).toBeNull();
  });
});
