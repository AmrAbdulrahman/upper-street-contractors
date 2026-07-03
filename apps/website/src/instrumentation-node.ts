/**
 * Node-only instrumentation. Imported lazily from `instrumentation.ts` only when
 * `NEXT_RUNTIME === "nodejs"`, so `process.cwd()` / fs APIs never reach the Edge build.
 *
 * Dev-only: watch the zero-cms type files and regenerate the typed client
 * (the `@cms` alias → <dir>/generated) on change.
 */
export async function startTypeWatcher() {
  try {
    const { watchFromConfig } = await import("@usc/zero-cms-core/node");
    await watchFromConfig(process.cwd(), {
      onGenerate: (file) => console.log("[zero-cms] generated", file),
      onError: (err) => console.warn("[zero-cms] codegen error", err),
    });
  } catch (err) {
    console.warn("[zero-cms] could not start type watcher", err);
  }
}
