// // Relation targets are heterogeneous (button→label, badge→text, icon→code,
// // image-container→imgDescription, sections→title/overline …) with no common
// // "name" field. Pick the first present string field by priority, else fall back
// // to the humanised type + short documentId. Pure module — safe on client+server.

// const LABEL_FIELD_PRIORITY = [
//   "label",
//   "text",
//   "title",
//   "name",
//   "siteName",
//   "code",
//   "imgDescription",
//   "overline",
//   "heading",
//   "altText",
// ];

// function humanizeSingular(singular: string): string {
//   return singular
//     .replace(/[-_]+/g, " ")
//     .replace(/^\w/, (char) => char.toUpperCase());
// }

// export function pickEntryLabel(
//   entry: Record<string, unknown> | null | undefined,
//   singular: string,
// ): string {
//   if (!entry) return "";
//   for (const fieldName of LABEL_FIELD_PRIORITY) {
//     const value = entry[fieldName];
//     if (typeof value === "string" && value.trim()) return value.trim();
//   }
//   const documentId =
//     typeof entry.documentId === "string" ? entry.documentId.slice(0, 6) : "";
//   return `${humanizeSingular(singular)}${documentId ? ` ${documentId}` : ""}`;
// }

// /** "api::button.button" → "button"; "api::at-aglance-card.at-aglance-card" → "at-aglance-card". */
// export function targetUidToSingular(target: string | undefined): string | null {
//   if (!target) return null;
//   const afterNamespace = target.split("::")[1];
//   if (!afterNamespace) return null;
//   return afterNamespace.split(".")[0] ?? null;
// }
