import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import {
  createNodeAdapter,
  createMemoryStoragePort,
  createMemoryBlobStore,
} from '@usc/zero-cms-core/node';
import { ZeroCmsWidget } from '../ZeroCmsWidget';
import { useInspect } from './use-inspect';

/**
 * The invariant behind two rounds of "Hydration failed because the server rendered
 * HTML didn't match the client": an inspect wrapper must render exactly what the
 * server sent on its FIRST render, however long ago the provider decided inspect
 * was on.
 *
 * `WidgetProvider` gating its own flag is not enough — it commits before deeper
 * Suspense boundaries hydrate, so by the time a wrapper inside one of them hydrates,
 * the context already says true. Only a per-component effect can be late enough.
 */
describe('useInspect', () => {
  async function adapter() {
    return createNodeAdapter(
      createMemoryStoragePort({ schema: [{ __name: 'page', fields: [] }] }),
      createMemoryBlobStore()
    );
  }

  it('never reports inspect on the first render, even with inspect on', async () => {
    const seen: boolean[] = [];
    function Probe() {
      seen.push(useInspect());
      return null;
    }

    render(
      <ZeroCmsWidget adapter={await adapter()} inspect>
        <Probe />
      </ZeroCmsWidget>
    );

    // The render that hydrates must match the server, which never renders inspect UI.
    expect(seen[0]).toBe(false);
    // And it must actually turn on afterwards, or inspect mode would never work.
    await waitFor(() => expect(seen.at(-1)).toBe(true));
  });

  it('stays false throughout when inspect is off', async () => {
    const seen: boolean[] = [];
    function Probe() {
      seen.push(useInspect());
      return null;
    }

    render(
      <ZeroCmsWidget adapter={await adapter()}>
        <Probe />
      </ZeroCmsWidget>
    );

    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen.every((v) => v === false)).toBe(true);
  });
});
