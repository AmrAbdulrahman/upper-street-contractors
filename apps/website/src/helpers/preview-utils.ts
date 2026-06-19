export function isPreviewEnabled(): boolean {
  return process.env.ENABLE_PREVIEW === "true";
}

export function withPreviewVariables(
  variables: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...variables,
    status: isPreviewEnabled() ? "DRAFT" : "PUBLISHED",
  };
}
