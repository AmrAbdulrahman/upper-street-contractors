export function isPreviewEnabled(): boolean {
  return process.env.ENABLE_PREVIEW === "true";
}

/** Cold-start overlay + client polling — preview/non-prod only. */
export function isColdStartGateBuildEnabled(): boolean {
  return isPreviewEnabled();
}

/** Editor login lock (and JWT sessions) — staging/preview only, like the cold-start gate. */
export function isLoginGateBuildEnabled(): boolean {
  return isPreviewEnabled();
}
