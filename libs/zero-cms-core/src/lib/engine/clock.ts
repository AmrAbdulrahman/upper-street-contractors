/**
 * Monotonic ISO timestamp — the optimistic-concurrency token (ADR 0009) must
 * never repeat across successive calls in the same process, or two rapid
 * mutations of the same record (millisecond-resolution `Date.toISOString()`
 * can collide, e.g. an eager backfill touching many entries fast) would produce
 * an identical "before" and "after" token, silently defeating the CAS check.
 * Cross-process collisions on the *same* record at the *same* millisecond are
 * astronomically unlikely for human-driven edits and not worth guarding
 * against here — Redis's `EVAL` CAS (ADR 0008) is the real cross-process
 * guarantee; this only protects same-process rapid-fire writes.
 */
let last = 0;

export function nextTimestamp(): string {
  const now = Date.now();
  last = now > last ? now : last + 1;
  return new Date(last).toISOString();
}
