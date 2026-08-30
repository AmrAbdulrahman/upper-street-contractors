import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createNodeAdapter, createMemoryStoragePort } from '@usc/zero-cms-core/node';
import type { Adapter, Schema } from '@usc/zero-cms-core';
import { ZeroCmsApp } from './ZeroCmsApp';

// Neither field carries a `label`, which is the normal case in the live schema
// — so what an editor reads is the humanized `__name`.
const schema: Schema = [
  {
    __name: 'note',
    label: 'Note',
    fields: [
      { __name: 'title', __type: 'text', required: true },
      { __name: 'doneTitle', __type: 'text' },
    ],
  },
];

async function mount() {
  const adapter: Adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
  render(<ZeroCmsApp adapter={adapter} />);
  return adapter;
}

describe('<ZeroCmsApp>', () => {
  it('renders the sections and a type side panel (not a dropdown)', async () => {
    await mount();
    expect(await screen.findByRole('button', { name: 'Content' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Types' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Media' })).toBeTruthy();
    // Users is auth-only (needs an auth client to manage accounts) — absent
    // when the app is mounted on a bare adapter.
    expect(screen.queryByRole('button', { name: 'Users' })).toBeNull();
    // The content type is chosen from a side-panel button (not a type dropdown).
    await waitFor(() => expect(screen.getByRole('button', { name: 'Note' })).toBeTruthy());
  });

  it('labels a field by its humanized key when the schema gives it none', async () => {
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: '+ New' }));
    // `title` -> "Title", and the camelCase key splits rather than showing raw.
    // Anchored at the start: the field's kind badge ("text") sits inside the
    // same <label>, so it lands in the accessible name too.
    expect(await screen.findByRole('textbox', { name: /^Title/ })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /^Done Title/ })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /doneTitle/ })).toBeNull();
  });

  it('creates a draft entry through the editor', async () => {
    const adapter = await mount();
    fireEvent.click(await screen.findByRole('button', { name: '+ New' }));
    const inputs = await screen.findAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));

    await waitFor(async () => {
      const res = await adapter.query('note', {
        status: 'draft',
        includeUnpublished: true,
      });
      expect(res.total).toBe(1);
    });
  });
});

describe('Entry title', () => {
  /** Create one entry and open it in the admin's editor panel. */
  async function openEntry(values: Record<string, unknown> = { title: 'Hello' }) {
    const adapter: Adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
    const created = await adapter.create('note', values, 'tester');
    render(<ZeroCmsApp adapter={adapter} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Note' }));
    fireEvent.click(await screen.findByRole('button', { name: /Hello|Untitled Note/ }));
    return { adapter, id: created.__id };
  }

  it('names an entry in the list by its title field', async () => {
    const adapter: Adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
    await adapter.create('note', { title: 'Kitchen survey' }, 'tester');
    render(<ZeroCmsApp adapter={adapter} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Note' }));
    expect(
      await screen.findByRole('button', { name: /Kitchen survey/ })
    ).toBeTruthy();
  });

  it('falls back to Untitled + the Type label with the short id beside it', async () => {
    const adapter: Adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
    const created = await adapter.create('note', {}, 'tester');
    render(<ZeroCmsApp adapter={adapter} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Note' }));
    const row = await screen.findByRole('button', { name: /Untitled Note/ });
    // The short id is the only thing telling two blank siblings apart, so it
    // shows exactly in this case.
    expect(row.textContent).toContain(created.__id.slice(0, 8));
  });

  it('shows the Title override in the Content admin, placeholdered with the derived title', async () => {
    await openEntry();
    const override = await screen.findByRole('textbox', { name: /Title override/ });
    expect(override.getAttribute('placeholder')).toBe('Hello');
  });

  it('saves the override on blur, with no publish', async () => {
    const { adapter, id } = await openEntry();
    const override = await screen.findByRole('textbox', { name: /Title override/ });
    fireEvent.change(override, { target: { value: 'Renamed' } });
    fireEvent.blur(override);

    await waitFor(async () => {
      const e = await adapter.get('note', id, {
        status: 'draft',
        includeUnpublished: true,
      });
      expect(e?.__title).toBe('Renamed');
    });
    // The entry is still an unpublished draft — the title did not wait for it.
    const e = await adapter.get('note', id, { status: 'draft', includeUnpublished: true });
    expect(e?.__status).toBe('unpublished');
  });

  it('clearing the override restores the derived title', async () => {
    const { adapter, id } = await openEntry();
    const override = await screen.findByRole('textbox', { name: /Title override/ });
    fireEvent.change(override, { target: { value: 'Renamed' } });
    fireEvent.blur(override);
    await waitFor(async () => {
      const e = await adapter.get('note', id, { status: 'draft', includeUnpublished: true });
      expect(e?.__title).toBe('Renamed');
    });

    fireEvent.change(override, { target: { value: '' } });
    fireEvent.blur(override);
    await waitFor(async () => {
      const e = await adapter.get('note', id, { status: 'draft', includeUnpublished: true });
      expect(e?.__title).toBeNull();
    });
  });

  it('is absent while creating — there is no entry to name yet', async () => {
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: '+ New' }));
    expect(await screen.findByRole('textbox', { name: /^Title/ })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /Title override/ })).toBeNull();
  });

  it('offers every non-relation field as the Type\u2019s Title field, and no relation', async () => {
    const withRelation: Schema = [
      {
        __name: 'note',
        label: 'Note',
        fields: [
          { __name: 'title', __type: 'text' },
          { __name: 'cover', __type: 'asset' },
          { __name: 'author', __type: 'reference', allowedTypes: ['note'] },
        ],
      },
    ];
    const adapter: Adapter = await createNodeAdapter(
      createMemoryStoragePort({ schema: withRelation })
    );
    render(<ZeroCmsApp adapter={adapter} />);
    // Wait for the schema before navigating: the nav strip renders first, and
    // clicking Types while the content pane is still a spinner races the
    // "default to the first type" effect.
    await screen.findByRole('button', { name: 'Note' });
    fireEvent.click(screen.getByRole('button', { name: 'Types' }));

    // The accessible name of a <select> inside its <label> swallows the option
    // text too, so match the label as a substring.
    const select = await screen.findByRole('combobox', { name: /Title field/ });
    const options = Array.from(select.querySelectorAll('option')).map(
      (o) => o.textContent
    );
    expect(options).toContain('Auto — first text field');
    expect(options).toContain('Title (text)');
    expect(options).toContain('Cover (asset)');
    expect(options.some((o) => o?.startsWith('Author'))).toBe(false);
  });
});
