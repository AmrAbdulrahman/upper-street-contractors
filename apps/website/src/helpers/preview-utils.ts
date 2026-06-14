export function isPreviewEnabled(): boolean {
  return process.env.ENABLE_PREVIEW === "true";
}

// export function getContentfulAccessToken(): string {
//   const preview = isPreviewEnabled();
//   const token = preview
//     ? process.env.CONTENTFUL_PREVIEW_TOKEN
//     : process.env.CONTENTFUL_ACCESS_TOKEN;

//   if (!token) {
//     throw new Error(
//       preview
//         ? "CONTENTFUL_PREVIEW_TOKEN is not set"
//         : "CONTENTFUL_ACCESS_TOKEN is not set",
//     );
//   }

//   return token;
// }

export function withPreviewVariables(
  variables: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...variables,
    status: isPreviewEnabled() ? "DRAFT" : "PUBLISHED",
  };
}
