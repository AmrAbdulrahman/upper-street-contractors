import { describe, it, expect } from 'vitest';
import { createRequestHandler } from './handler';
import { RPC_PATH } from '../adapter/protocol';
import type { Adapter } from '../adapter/adapter';

/**
 * Input robustness of the RPC transport (TEST-REPORT F5): bad input is the
 * caller's error and must map to 400 VALIDATION, never a 500. The adapter is
 * never reached on these paths, so a stub suffices.
 */

const handle = createRequestHandler({} as Adapter);
const url = `http://test${RPC_PATH}`;

const post = (body: string) =>
  handle(
    new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
  );

describe('createRequestHandler input robustness', () => {
  it('maps a malformed JSON body to 400 VALIDATION (was 500 CONFLICT)', async () => {
    const res = await post('{nope');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });

  it('maps a JSON null body to 400 (unknown op), not a destructure crash', async () => {
    const res = await post('null');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });
});
