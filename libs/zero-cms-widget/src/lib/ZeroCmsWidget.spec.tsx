import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createNodeAdapter, createMemoryStoragePort } from '@usc/zero-cms-core/node';
import type { Schema } from '@usc/zero-cms-core';
import { ZeroCmsWidget } from './ZeroCmsWidget';
import { useZeroCmsWidget } from './context';
import { ZeroCmsEntry } from './inspect/ZeroCmsEntry';
import { ZeroCmsEntryField } from './inspect/ZeroCmsEntryField';

const schema: Schema = [
  {
    __name: 'note',
    label: 'Note',
    fields: [
      { __name: 'title', __type: 'text', required: true },
      { __name: 'body', __type: 'longtext' },
    ],
  },
];

function Host({ id, focusField }: { id: string; focusField?: string }) {
  const { openEntry } = useZeroCmsWidget();
  return (
    <button onClick={() => void openEntry(id, { focusField })}>edit</button>
  );
}

describe('<ZeroCmsWidget>', () => {
  it('opens the in-place drawer by id (type resolved via locate) and loads the entry', async () => {
    const adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
    const created = await adapter.create('note', { title: 'Hello widget' });

    render(
      <ZeroCmsWidget adapter={adapter}>
        <Host id={created.__id} />
      </ZeroCmsWidget>
    );

    // No drawer until triggered.
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: 'edit' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    await waitFor(() => {
      const title = screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement;
      expect(title.value).toBe('Hello widget');
    });
  });

  it('opens focused on a field and highlights it', async () => {
    const adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
    const created = await adapter.create('note', { title: 'T', body: 'B' });

    const { container } = render(
      <ZeroCmsWidget adapter={adapter}>
        <Host id={created.__id} focusField="body" />
      </ZeroCmsWidget>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'edit' }));
    await screen.findByRole('dialog');
    // The focused field's wrapper gets the highlight ring.
    await waitFor(() => expect(container.querySelector('.ring-2')).toBeTruthy());
  });

  it('stacks a second drawer over the first and Escape pops back to the parent', async () => {
    const adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
    const a = await adapter.create('note', { title: 'Parent A' });
    const b = await adapter.create('note', { title: 'Child B' });

    render(
      <ZeroCmsWidget adapter={adapter}>
        <Host id={a.__id} />
        <Host id={b.__id} />
      </ZeroCmsWidget>
    );

    const [editA, editB] = await screen.findAllByRole('button', { name: 'edit' });

    fireEvent.click(editA);
    await screen.findByRole('dialog');
    // include hidden — lower (inert) panels may be excluded from the a11y tree.
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1);

    fireEvent.click(editB);
    await waitFor(() =>
      expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2)
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1)
    );
  });

  it('inspect mode renders <ZeroCmsEntry>/<ZeroCmsEntryField> children', async () => {
    const adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
    const created = await adapter.create('note', { title: 'Wrapped', body: 'B' });

    render(
      <ZeroCmsWidget adapter={adapter} inspect>
        <ZeroCmsEntry entry={{ __id: created.__id, __type: 'note' }}>
          <ZeroCmsEntryField field="title">
            <h2>Wrapped</h2>
          </ZeroCmsEntryField>
        </ZeroCmsEntry>
      </ZeroCmsWidget>
    );

    expect(await screen.findByText('Wrapped')).toBeTruthy();
  });
});
