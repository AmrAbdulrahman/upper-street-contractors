/**
 * `NEXT_PUBLIC_APP_ENV` distinguishes a public **production** deploy from an editor-facing
 * **preview** deploy. In `preview` the site reads draft/unpublished content, shows
 * the zero-cms editor bar, and revalidates on save/publish. Replaces the old
 * `ENABLE_PREVIEW` flag.
 *
 * Server-only by nature (`process.env.NEXT_PUBLIC_APP_ENV` is not exposed to the client) — pass
 * the resolved boolean into client components as a prop.
 */

export type AppEnv = "preview" | "production";

export function getAppEnv(): AppEnv {
  return process.env.NEXT_PUBLIC_APP_ENV === "preview" ? "preview" : "production";
}

/** True on an editor-facing preview deploy. */
export function isPreview(): boolean {
  return getAppEnv() === "preview";
}
