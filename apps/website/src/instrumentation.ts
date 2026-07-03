/**
 * Runs in both the Node and Edge runtimes, so it must stay free of Node APIs.
 * The actual (Node-only) work lives in `instrumentation-node.ts`, imported lazily
 * only under the `nodejs` runtime guard — keeping `process.cwd()`/fs out of Edge.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "development") return;
  const { startTypeWatcher } = await import("./instrumentation-node");
  await startTypeWatcher();
}
