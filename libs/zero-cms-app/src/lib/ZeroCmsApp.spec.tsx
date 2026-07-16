import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createNodeAdapter, createMemoryStoragePort } from '@usc/zero-cms-core/node';
import type { Adapter, Schema } from '@usc/zero-cms-core';
import { ZeroCmsApp } from './ZeroCmsApp';

const schema: Schema = [
  { __name: 'note', label: 'Note', fields: [{ __name: 'title', __type: 'text', required: true }] },
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
