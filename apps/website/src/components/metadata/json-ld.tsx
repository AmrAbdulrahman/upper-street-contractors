/**
 * One `<script type="application/ld+json">`, shared by every structured-data
 * component so they cannot drift in how they serialise.
 *
 * `undefined` values are dropped by `JSON.stringify`, which is what lets each
 * builder below write `field: value ?? undefined` and have absent data simply
 * not appear rather than publish `null` — a null in structured data is a claim
 * that the value is empty, not that it is unknown.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
