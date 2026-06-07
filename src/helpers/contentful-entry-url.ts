export function buildContentfulEntryUrl({
  spaceId,
  environmentId = "master",
  entryId,
  focusedField,
}: {
  spaceId: string;
  environmentId?: string;
  entryId: string;
  focusedField?: string;
}): string {
  const base = `https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${entryId}`;

  if (!focusedField) {
    return base;
  }

  const params = new URLSearchParams({ focusedField });
  return `${base}?${params.toString()}`;
}
