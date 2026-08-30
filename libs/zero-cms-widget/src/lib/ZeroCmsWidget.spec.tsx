import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createNodeAdapter, createMemoryStoragePort } from '@usc/zero-cms-core/node';
import type { Adapter, Schema } from '@usc/zero-cms-core';
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

  it('keeps focus in the field while typing (dirty-flag re-renders must not re-grab)', async () => {
    const adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
    const created = await adapter.create('note', { title: 'Focus me' });

    render(
      <ZeroCmsWidget adapter={adapter}>
        <Host id={created.__id} />
      </ZeroCmsWidget>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'edit' }));
    await screen.findByRole('dialog');
    const title = (await screen.findByRole('textbox', { name: /title/i })) as HTMLInputElement;
    await waitFor(() => expect(title.value).toBe('Focus me'));

    title.focus();
    // First edit flips the form dirty -> DrawerBody re-renders with a fresh
    // inline onClose -> the old Drawer effect re-ran panel.focus(), blurring
    // the input mid-keystroke (the prod "unfocus" bug).
    fireEvent.change(title, { target: { value: 'Focus me!' } });
    await waitFor(() => expect(title.value).toBe('Focus me!'));
    expect(document.activeElement).toBe(title);
  });

  it('freezes every control in the drawer while an autosave is in flight', async () => {
    const base = await createNodeAdapter(createMemoryStoragePort({ schema }));
    const created = await base.create('note', { title: 'Freeze me' });

    // Hold the autosave write open so the in-flight state can be inspected,
    // then let it land. Only `update` is gated — `get` still needs to resolve
    // for the drawer to load at all.
    let release: (() => void) | undefined;
    const adapter = {
      ...base,
      update: ((...args: Parameters<typeof base.update>) =>
        new Promise((resolve, reject) => {
          release = () => base.update(...args).then(resolve, reject);
        })) as typeof base.update,
    };

    render(
      <ZeroCmsWidget adapter={adapter}>
        <Host id={created.__id} />
      </ZeroCmsWidget>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'edit' }));
    await screen.findByRole('dialog');
    const title = (await screen.findByRole('textbox', {
      name: /title/i,
    })) as HTMLInputElement;
    await waitFor(() => expect(title.value).toBe('Freeze me'));

    fireEvent.change(title, { target: { value: 'Freeze me now' } });

    // Real timers: the autosave debounce is ~1.5s and faking it here would mean
    // faking the 100ms ticker and Date.now() together, which is more machinery
    // than a single 1.5s wait is worth.
    await waitFor(() => expect(screen.getByText('Auto-saving…')).toBeTruthy(), {
      timeout: 5000,
    });

    // Inside the form: one disabled fieldset covers fields AND footer actions.
    // Asserted with `:disabled` rather than `.disabled` — the IDL property only
    // reflects an element's OWN attribute, while the fieldset disables its
    // descendants from the outside (which is what actually blocks their events).
    expect(title.matches(':disabled')).toBe(true);
    for (const label of ['Publish', 'Delete']) {
      expect(
        screen.getByRole('button', { name: label, hidden: true }).matches(':disabled')
      ).toBe(true);
    }

    // Outside it: the header Close button and the backdrop both go inert too.
    for (const closer of screen.getAllByRole('button', { name: 'Close', hidden: true })) {
      expect(closer.matches(':disabled')).toBe(true);
    }

    // ...and Escape must not unmount the form the write settles into. Stubbed
    // to SAY YES to discarding, so the panel surviving proves the saving guard
    // held rather than the unsaved-changes confirm having quietly caught it.
    const confirmSpy = vi.fn(() => true);
    const realConfirm = window.confirm;
    window.confirm = confirmSpy;
    try {
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1);
      expect(confirmSpy).not.toHaveBeenCalled();
    } finally {
      window.confirm = realConfirm;
    }

    release?.();
    await waitFor(() => expect(title.matches(':disabled')).toBe(false));
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

describe('drawer breadcrumb', () => {
  /** Open A, then B on top of it — the smallest real stack. */
  async function stackTwo(adapter: Adapter) {
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
    fireEvent.click(editB);
    await waitFor(() =>
      expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2)
    );

    // A crumb is only named once its editor has loaded the entry, so wait for
    // BOTH — asserting on a half-loaded trail is how this test goes flaky.
    const top = () => screen.getAllByRole('dialog', { hidden: true })[1];
    await screen.findByRole('button', { name: 'Note · Parent A', hidden: true });
    await waitFor(() =>
      expect(
        within(top()).getByRole('navigation', { name: 'Editing path', hidden: true })
          .textContent
      ).toContain('Child B')
    );
    return { a, b, top };
  }

  /** The ancestor crumb, which is the jump-back control. */
  const parentCrumb = () =>
    screen.getByRole('button', { name: 'Note · Parent A', hidden: true });

  it('names every panel by Type and entry title, and only the current one is not a link', async () => {
    const adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
    const { top } = await stackTwo(adapter);

    // One trail per panel; the deepest lists both crumbs.
    expect(
      screen.getAllByRole('navigation', { name: 'Editing path', hidden: true })
    ).toHaveLength(2);

    const trail = within(top()).getByRole('navigation', {
      name: 'Editing path',
      hidden: true,
    });
    const items = [...trail.querySelectorAll('li')];
    const crumbs = items.map((li) => li.textContent?.trim());
    expect(crumbs).toEqual(['Note · Parent A', 'Note · Child B']);
    // The nested crumb wears the corner-down-right mark; the root has nothing
    // to descend from.
    expect(items.map((li) => Boolean(li.querySelector('svg')))).toEqual([false, true]);

    // The ancestor is reachable; the panel you are standing in is not a control.
    expect(trail.querySelector('button')?.textContent?.trim()).toBe('Note · Parent A');
    expect(trail.querySelector('[aria-current]')?.textContent?.trim()).toBe(
      'Note · Child B'
    );
  });

  it('jumps back to an ancestor, closing every panel above it', async () => {
    const adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
    await stackTwo(adapter);

    fireEvent.click(parentCrumb());
    await waitFor(() =>
      expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1)
    );
    // ...and the panel left behind is the one that was clicked.
    expect(
      screen.getByRole('navigation', { name: 'Editing path' }).textContent
    ).toContain('Parent A');
  });

  it('asks once before discarding an unsaved panel, and stays put on refusal', async () => {
    const adapter = await createNodeAdapter(createMemoryStoragePort({ schema }));
    const { top } = await stackTwo(adapter);

    // Autosave off first: with it armed, the 1.5s debounce can land between the
    // edit and the click and clear the very dirty flag under test.
    const panel = within(top());
    fireEvent.click(panel.getByLabelText('Auto-save changes'));

    const title = panel.getByRole('textbox', { name: /^title/i }) as HTMLInputElement;
    await waitFor(() => expect(title.value).toBe('Child B'));
    fireEvent.change(title, { target: { value: 'Child B edited' } });

    const realConfirm = window.confirm;
    const confirmSpy = vi.fn(() => false);
    window.confirm = confirmSpy;
    try {
      // Retried: the dirty flag reaches the host an effect pass later. Clicking
      // again is harmless while the stub refuses.
      await waitFor(() => {
        fireEvent.click(parentCrumb());
        expect(confirmSpy).toHaveBeenCalled();
      });
      expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2);

      confirmSpy.mockReturnValue(true);
      fireEvent.click(parentCrumb());
      await waitFor(() =>
        expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1)
      );
    } finally {
      window.confirm = realConfirm;
    }
  });

  it('refuses the jump outright while a panel above is mid-autosave', async () => {
    const base = await createNodeAdapter(createMemoryStoragePort({ schema }));

    // Hold the autosave write open, exactly as the freeze test does.
    let release: (() => void) | undefined;
    const adapter = {
      ...base,
      update: ((...args: Parameters<typeof base.update>) =>
        new Promise((resolve, reject) => {
          release = () => base.update(...args).then(resolve, reject);
        })) as typeof base.update,
    } as Adapter;

    const { top } = await stackTwo(adapter);

    const title = within(top()).getByRole('textbox', {
      name: /^title/i,
    }) as HTMLInputElement;
    await waitFor(() => expect(title.value).toBe('Child B'));
    fireEvent.change(title, { target: { value: 'Child B saving' } });
    await waitFor(() => expect(screen.getByText('Auto-saving…')).toBeTruthy(), {
      timeout: 5000,
    });

    // Stubbed to SAY YES, so the stack surviving proves the saving guard held
    // rather than the unsaved-changes confirm having caught it first.
    const realConfirm = window.confirm;
    const confirmSpy = vi.fn(() => true);
    window.confirm = confirmSpy;
    try {
      fireEvent.click(parentCrumb());
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2);
    } finally {
      window.confirm = realConfirm;
    }

    release?.();
    await waitFor(() => expect(title.matches(':disabled')).toBe(false));
  });
});
