import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  createNodeAdapter,
  createMemoryStoragePort,
  createMemoryBlobStore,
} from '@usc/zero-cms-core/node';
import type { Adapter, Schema } from '@usc/zero-cms-core';
import { ZeroCmsWidget } from './ZeroCmsWidget';
import { useZeroCmsWidget } from './context';
import { ZeroCmsEntry } from './inspect/ZeroCmsEntry';
import { ZeroCmsEntryProvider } from './inspect/entry-context';
import { ZeroCmsSectionList } from './inspect/ZeroCmsSectionList';

/**
 * `prose` has entries in every fixture below (the seeded sections are prose), so
 * picking it lands on the reuse step. `quote` never has any, so picking it goes
 * straight to a create form — the two branches of the Type picker.
 */
const schema: Schema = [
  {
    __name: 'prose',
    label: 'Rich Text',
    description: 'Text content with formatting',
    thumbnail: 'richText',
    fields: [{ __name: 'title', __type: 'text' }],
  },
  {
    __name: 'quote',
    label: 'Quote',
    description: 'A pull-quote with attribution',
    thumbnail: 'quote',
    fields: [{ __name: 'title', __type: 'text' }],
  },
  {
    __name: 'page',
    label: 'Page',
    fields: [
      { __name: 'key', __type: 'text' },
      {
        __name: 'sections',
        __type: 'references',
        label: 'Sections',
        allowedTypes: ['prose', 'quote'],
      },
    ],
  },
];

const ACTOR = 'spec';

type Fixture = {
  adapter: Adapter;
  pageId: string;
  sections: Array<{ id: string; type: string; title: string }>;
};

/** A page with two prose sections, plus one unlinked prose entry to reuse. */
async function fixture(): Promise<Fixture> {
  const adapter = await createNodeAdapter(createMemoryStoragePort({ schema }), createMemoryBlobStore());
  const one = await adapter.create('prose', { title: 'Section one' }, ACTOR);
  const two = await adapter.create('prose', { title: 'Section two' }, ACTOR);
  await adapter.create('prose', { title: 'Spare block' }, ACTOR);
  const page = await adapter.create(
    'page',
    { key: 'home', sections: [one.__id, two.__id] },
    ACTOR
  );
  return {
    adapter,
    pageId: page.__id,
    sections: [
      { id: one.__id, type: 'prose', title: 'Section one' },
      { id: two.__id, type: 'prose', title: 'Section two' },
    ],
  };
}

/**
 * Open a section's floating action cluster. The pencil and trash only exist
 * while the section is hovered (they are portaled to body on `pointerenter`),
 * so every removal test has to hover first — same as a real editor.
 */
async function hoverSection(title: string): Promise<void> {
  const host = (await screen.findByText(title)).closest('section');
  fireEvent.pointerEnter(host!);
}

/** Read the page's DRAFT section ids — where every in-place edit lands. */
async function draftSections(adapter: Adapter, pageId: string): Promise<string[]> {
  const page = await adapter.get('page', pageId, {
    status: 'draft',
    includeUnpublished: true,
  });
  return (page?.sections as string[]) ?? [];
}

/** Publish the page, presenting its current CAS token (ADR 0009). */
async function publishPage(adapter: Adapter, pageId: string): Promise<void> {
  const page = await adapter.get('page', pageId, {
    status: 'draft',
    includeUnpublished: true,
  });
  await adapter.publish('page', pageId, ACTOR, page!.__lastEditedAt);
}

function Builder({ fx, inspect = true }: { fx: Fixture; inspect?: boolean }) {
  return (
    <ZeroCmsWidget adapter={fx.adapter} inspect={inspect}>
      <ZeroCmsEntryProvider entry={{ __id: fx.pageId, __type: 'page' }}>
        <ZeroCmsSectionList
          field="sections"
          items={fx.sections.map((s) => ({ id: s.id, type: s.type }))}
        >
          {fx.sections.map((s) => (
            <ZeroCmsEntry key={s.id} entry={{ id: s.id, type: s.type }}>
              <section>{s.title}</section>
            </ZeroCmsEntry>
          ))}
        </ZeroCmsSectionList>
      </ZeroCmsEntryProvider>
    </ZeroCmsWidget>
  );
}

describe('<ZeroCmsSectionList> — the Section builder', () => {
  it('renders children untouched when inspect is off (the site-wide rollout guarantee)', async () => {
    const fx = await fixture();
    const { container } = render(<Builder fx={fx} inspect={false} />);

    expect(await screen.findByText('Section one')).toBeTruthy();
    // No add slots, no slot wrappers, no drag handles — nothing but the sections.
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelectorAll('[data-zero-cms-section-slot]')).toHaveLength(0);
    expect(container.querySelectorAll('section')).toHaveLength(2);
  });

  it('offers an insert slot before the first section, between, and after the last', async () => {
    const fx = await fixture();
    render(<Builder fx={fx} />);

    // n sections ⇒ n + 1 insertion points.
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Add section at position/ })).toHaveLength(3)
    );
    for (const pos of [1, 2, 3]) {
      expect(
        screen.getByRole('button', { name: `Add section at position ${pos}` })
      ).toBeTruthy();
    }
  });

  it('creates a new section through the Type picker and links it AT the clicked position', async () => {
    const fx = await fixture();
    render(<Builder fx={fx} />);

    // Position 2 = between the two existing sections.
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add section at position 2' })
    );

    // The picker offers every allowed Type with its label + description.
    // Queried as a heading: "Add section" is also the add-slot buttons' text.
    expect(await screen.findByRole('heading', { name: 'Add section' })).toBeTruthy();
    expect(screen.getByText('Text content with formatting')).toBeTruthy();
    const quote = await screen.findByRole('button', { name: /Quote/ });

    // No `quote` entries exist, so this skips reuse and opens the create form.
    fireEvent.click(quote);
    const title = (await screen.findByRole('textbox', {
      name: /title/i,
    })) as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Inserted quote' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Create draft' }));

    await waitFor(async () => {
      const ids = await draftSections(fx.adapter, fx.pageId);
      expect(ids).toHaveLength(3);
      // Inserted, not appended.
      expect(ids[0]).toBe(fx.sections[0].id);
      expect(ids[2]).toBe(fx.sections[1].id);
    });

    const ids = await draftSections(fx.adapter, fx.pageId);
    const inserted = await fx.adapter.get('quote', ids[1], {
      status: 'draft',
      includeUnpublished: true,
    });
    expect(inserted?.title).toBe('Inserted quote');
  });

  it('links an existing entry through the picker, badged with how many pages already use it', async () => {
    const fx = await fixture();
    render(<Builder fx={fx} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Add section at position 1' })
    );
    // Anchored: each drag handle is also labelled with its Type ("Reorder
    // section 1 of 2: Rich Text"), so an unanchored /Rich Text/ is ambiguous.
    // `prose` entries exist, so this Type opens the reuse step.
    fireEvent.click(await screen.findByRole('button', { name: /^Rich Text/ }));

    const spare = await screen.findByRole('button', { name: /Spare block/ });
    // Usage counts come from the parent Type's own entries: the two linked
    // sections read "used in 1 page", the unlinked one "unused".
    expect(spare.textContent).toContain('unused');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Section one/ }).textContent
      ).toContain('used in 1 page')
    );

    fireEvent.click(spare);

    await waitFor(async () => {
      const ids = await draftSections(fx.adapter, fx.pageId);
      expect(ids).toHaveLength(3);
      expect(ids[1]).toBe(fx.sections[0].id);
      expect(ids[2]).toBe(fx.sections[1].id);
    });
  });

  it('reorder moves one id and leaves the rest in order', async () => {
    const fx = await fixture();
    const third = await fx.adapter.create('prose', { title: 'Section three' }, ACTOR);
    await fx.adapter.patch(
      'page',
      fx.pageId,
      { sections: [...fx.sections.map((s) => s.id), third.__id] },
      ACTOR,
      (await fx.adapter.get('page', fx.pageId, { status: 'draft', includeUnpublished: true }))!
        .__lastEditedAt
    );

    // A real dnd-kit drag needs pointer capture + rAF, which jsdom does not
    // model; the persistence is the part worth pinning, so drive the op itself.
    function Host() {
      const { reorder } = useZeroCmsWidget();
      return (
        <button
          onClick={() =>
            void reorder({
              parentId: fx.pageId,
              parentType: 'page',
              parentField: 'sections',
              from: 2,
              to: 0,
            })
          }
        >
          move
        </button>
      );
    }
    render(
      <ZeroCmsWidget adapter={fx.adapter} inspect>
        <Host />
      </ZeroCmsWidget>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'move' }));
    await waitFor(async () =>
      expect(await draftSections(fx.adapter, fx.pageId)).toEqual([
        third.__id,
        fx.sections[0].id,
        fx.sections[1].id,
      ])
    );
  });

  it('"Remove from the page" unlinks but leaves the entry in the CMS', async () => {
    const fx = await fixture();
    render(<Builder fx={fx} />);

    await hoverSection('Section one');
    fireEvent.click(await screen.findByRole('button', { name: /^Remove section 1 of 2/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove from the page' }));

    await waitFor(async () =>
      expect(await draftSections(fx.adapter, fx.pageId)).toEqual([fx.sections[1].id])
    );
    // The content itself survives and can be linked back in.
    expect(
      await fx.adapter.get('prose', fx.sections[0].id, {
        status: 'draft',
        includeUnpublished: true,
      })
    ).toBeTruthy();
  });

  it('"Delete permanently" still unlinks when Reference integrity refuses, and names the holder', async () => {
    const fx = await fixture();
    // Publishing the page puts the section ids in its live `values`, so the
    // PUBLISHED page keeps referencing the section after the draft unlink —
    // exactly the common case the dialog has to explain rather than swallow.
    await publishPage(fx.adapter, fx.pageId);

    render(<Builder fx={fx} />);

    await hoverSection('Section one');
    fireEvent.click(await screen.findByRole('button', { name: /^Remove section 1 of 2/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete permanently' }));

    // The refusal is reported with the actual holder, not a bare stack trace.
    const alert = await screen.findByText(/still referenced by/i);
    expect(alert.textContent).toContain('Removed from the page.');
    expect(alert.textContent).toContain('Page');

    // Unlink applied; entry deliberately NOT destroyed.
    await waitFor(async () =>
      expect(await draftSections(fx.adapter, fx.pageId)).toEqual([fx.sections[1].id])
    );
    expect(
      await fx.adapter.get('prose', fx.sections[0].id, {
        status: 'draft',
        includeUnpublished: true,
      })
    ).toBeTruthy();
  });

  it('"Delete permanently" destroys the entry once nothing references it', async () => {
    const fx = await fixture();
    render(<Builder fx={fx} />);

    await hoverSection('Section two');
    fireEvent.click(await screen.findByRole('button', { name: /^Remove section 2 of 2/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete permanently' }));

    await waitFor(async () =>
      expect(await draftSections(fx.adapter, fx.pageId)).toEqual([fx.sections[0].id])
    );
    await waitFor(async () =>
      expect(
        await fx.adapter.get('prose', fx.sections[1].id, {
          status: 'draft',
          includeUnpublished: true,
        })
      ).toBeNull()
    );
  });

  it('wraps the list in inspect mode and leaves a public page a bare fragment', async () => {
    const fx = await fixture();
    const { container, unmount } = render(<Builder fx={fx} />);
    await waitFor(() =>
      expect(container.querySelector('[data-zero-cms-section-list="sections"]')).toBeTruthy()
    );
    // The wrapper is a plain passthrough until a drag starts — it only becomes the
    // reorder outline then, and nothing about a resting page is repositioned.
    expect(container.querySelector('[data-zero-cms-outline]')).toBeNull();
    unmount();

    const off = render(<Builder fx={fx} inspect={false} />);
    expect(await off.findByText('Section one')).toBeTruthy();
    expect(off.container.querySelector('[data-zero-cms-section-list]')).toBeNull();
  });

  it('does not leak the slot into an entry nested inside a section', async () => {
    const fx = await fixture();
    render(
      <ZeroCmsWidget adapter={fx.adapter} inspect>
        <ZeroCmsEntryProvider entry={{ __id: fx.pageId, __type: 'page' }}>
          <ZeroCmsSectionList
            field="sections"
            items={fx.sections.map((s) => ({ id: s.id, type: s.type }))}
          >
            {fx.sections.map((s) => (
              <ZeroCmsEntry key={s.id} entry={{ id: s.id, type: s.type }}>
                <section>
                  {s.title}
                  {/* A card or field inside the section — its own entry. */}
                  <ZeroCmsEntry entry={{ id: `${s.id}-child`, type: 'cta' }}>
                    <span>child of {s.title}</span>
                  </ZeroCmsEntry>
                </section>
              </ZeroCmsEntry>
            ))}
          </ZeroCmsSectionList>
        </ZeroCmsEntryProvider>
      </ZeroCmsWidget>
    );

    // Hover the CHILD entry's own host. `pointerenter` does not bubble, so this
    // mounts that entry's cluster and nothing else's.
    fireEvent.pointerEnter(await screen.findByText(/child of Section one/));

    // Section-slot context reaches every descendant, so the nested entry used
    // to read its HOST's slot and grow its own "Remove section 1 of 2" — a
    // control that looked like it belonged to the card but unlinked the whole
    // section. A nested entry gets a pencil and nothing else.
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Edit entry/ })).toHaveLength(1)
    );
    expect(screen.queryByRole('button', { name: /^Remove section/ })).toBeNull();
  });

  it('disables every insert slot at the field max', async () => {
    const capped: Schema = schema.map((t) =>
      t.__name === 'page'
        ? {
            ...t,
            fields: t.fields.map((f) =>
              f.__name === 'sections' ? { ...f, max: 2 } : f
            ),
          }
        : t
    );
    const adapter = await createNodeAdapter(createMemoryStoragePort({ schema: capped }), createMemoryBlobStore());
    const one = await adapter.create('prose', { title: 'One' }, ACTOR);
    const two = await adapter.create('prose', { title: 'Two' }, ACTOR);
    const page = await adapter.create('page', { sections: [one.__id, two.__id] }, ACTOR);

    render(
      <Builder
        fx={{
          adapter,
          pageId: page.__id,
          sections: [
            { id: one.__id, type: 'prose', title: 'One' },
            { id: two.__id, type: 'prose', title: 'Two' },
          ],
        }}
      />
    );

    await waitFor(() => {
      for (const b of screen.getAllByRole('button', { name: /^Add section at position/ })) {
        expect(b.matches(':disabled')).toBe(true);
        expect(b.getAttribute('title')).toBe('Maximum of 2 reached');
      }
    });
  });
});

// The remove dialog is the only destructive affordance reachable in one click
// from the page, so it must never act without the editor choosing an outcome.
describe('remove dialog', () => {
  it('cancels without touching anything', async () => {
    const fx = await fixture();
    const patch = vi.spyOn(fx.adapter, 'patch');
    render(<Builder fx={fx} />);

    await hoverSection('Section one');
    fireEvent.click(await screen.findByRole('button', { name: /^Remove section 1 of 2/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText('Remove section')).toBeNull());
    expect(patch).not.toHaveBeenCalled();
    expect(await draftSections(fx.adapter, fx.pageId)).toHaveLength(2);
  });
});

/**
 * A relation field inside the Edit drawer used to render one "＋ Add new <Type>"
 * button per allowed Type. On a page's `sections` — 23 allowed Types — that was
 * a wall of buttons rather than a control. It routes through the Type picker now.
 */
describe('references field inside the Edit drawer', () => {
  /** Open the page entry's own drawer, where its `sections` field renders. */
  async function openPageDrawer(fx: Fixture) {
    function Host() {
      const { openEntry } = useZeroCmsWidget();
      return (
        <button onClick={() => void openEntry(fx.pageId, { type: 'page' })}>open page</button>
      );
    }
    render(
      <ZeroCmsWidget adapter={fx.adapter} inspect>
        <Host />
      </ZeroCmsWidget>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'open page' }));
    await screen.findByRole('dialog');
  }

  it('offers ONE "+ Add…" rather than one button per allowed Type', async () => {
    const fx = await fixture();
    await openPageDrawer(fx);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '+ Add…', hidden: true })).toBeTruthy()
    );
    // The wall is gone.
    expect(screen.queryAllByRole('button', { name: /Add new/i, hidden: true })).toHaveLength(0);
  });

  it('"+ Add…" opens the Type picker, and choosing a Type links a new entry', async () => {
    const fx = await fixture();
    await openPageDrawer(fx);

    fireEvent.click(await screen.findByRole('button', { name: '+ Add…', hidden: true }));

    // Same picker the insert slots use — glyph grid with labels + descriptions.
    expect(
      await screen.findByRole('heading', { name: 'Add section', hidden: true })
    ).toBeTruthy();
    expect(screen.getByText('A pull-quote with attribution')).toBeTruthy();

    // `quote` has no entries, so this goes straight to the create form.
    fireEvent.click(await screen.findByRole('button', { name: /^Quote/, hidden: true }));
    const title = (await screen.findByRole('textbox', {
      name: /title/i,
      hidden: true,
    })) as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'From the drawer' } });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Create draft', hidden: true })
    );

    // The new entry exists and the field picked it up (the parent form still
    // needs saving, so the DRAFT array is unchanged until then — what matters
    // here is that the picker produced a real entry rather than 23 buttons).
    await waitFor(async () => {
      const { data } = await fx.adapter.query('quote', {
        status: 'draft',
        includeUnpublished: true,
      });
      expect(data.map((e) => e.title)).toContain('From the drawer');
    });
  });
});

describe('Type picker create-vs-reuse decision', () => {
  it('waits for option lists before deciding a Type has nothing to reuse', async () => {
    const fx = await fixture();
    // Hold the option-list query open so the picker renders BEFORE it knows
    // which Types have existing entries. Reading `options.length === 0` in that
    // window reported "nothing to reuse" for `prose`, which has three entries,
    // and skipped the reuse step entirely.
    // One pending resolver PER call: useEntryOptions queries each allowed Type
    // separately (and useUsageCounts queries the parent Type), so a single-shot
    // release would only free the last of them.
    const pending: Array<() => void> = [];
    const gated: Adapter = {
      ...fx.adapter,
      query: ((...args: Parameters<Adapter['query']>) =>
        new Promise((resolve, reject) => {
          pending.push(() => fx.adapter.query(...args).then(resolve, reject));
        })) as Adapter['query'],
    };
    const releaseAll = () => {
      while (pending.length) pending.shift()!();
    };

    render(
      <ZeroCmsWidget adapter={gated} inspect>
        <ZeroCmsEntryProvider entry={{ __id: fx.pageId, __type: 'page' }}>
          <ZeroCmsSectionList
            field="sections"
            items={fx.sections.map((s) => ({ id: s.id, type: s.type }))}
          >
            {fx.sections.map((s) => (
              <ZeroCmsEntry key={s.id} entry={{ id: s.id, type: s.type }}>
                <section>{s.title}</section>
              </ZeroCmsEntry>
            ))}
          </ZeroCmsSectionList>
        </ZeroCmsEntryProvider>
      </ZeroCmsWidget>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Add section at position 1' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Rich Text/ }));

    // Landed on the reuse step, not the create form.
    expect(await screen.findByRole('button', { name: /Create new Rich Text/ })).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create draft' })).toBeNull();

    // Once the options land, the reusable entries appear in place.
    releaseAll();
    await waitFor(() => expect(screen.getByRole('button', { name: /Spare block/ })).toBeTruthy());
  });
});
