/** Isomorphic base64 <-> bytes (node Buffer or browser atob/btoa). */

interface BufferLike {
  from(input: Uint8Array | string, enc?: string): {
    toString(enc: string): string;
  } & Uint8Array;
}

function nodeBuffer(): BufferLike | undefined {
  return (globalThis as { Buffer?: BufferLike }).Buffer;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const B = nodeBuffer();
  if (B) return B.from(bytes).toString('base64');
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const B = nodeBuffer();
  if (B) return new Uint8Array(B.from(b64, 'base64'));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
