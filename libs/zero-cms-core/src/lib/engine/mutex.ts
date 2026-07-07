/**
 * Tiny async mutex. All writes are serialized through one of these so concurrent
 * requests can't interleave file writes (single-writer model, ADR 0003).
 */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn, fn);
    // Swallow rejection for the chain so one failure doesn't poison the queue.
    this.tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}
