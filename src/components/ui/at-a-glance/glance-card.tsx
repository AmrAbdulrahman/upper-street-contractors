import { ContentfulEntryField } from "@/components/contentful/contentful-entry-field";

export type GlanceCardProps = {
  value: string;
  valueAccent?: string | null;
  label: string;
};

export function GlanceCard({ value, valueAccent, label }: GlanceCardProps) {
  return (
    <div className="rounded-lg border border-white/5 bg-[rgba(255,255,255,0.06)] px-5 py-4">
      <p className="font-serif text-3xl leading-none tracking-tight text-white">
        <ContentfulEntryField field="quantity" as="span">
          <span>{value}</span>
        </ContentfulEntryField>

        {valueAccent ? (
          <ContentfulEntryField field="unit" as="span">
            <span className="text-gold-mid">{valueAccent}</span>
          </ContentfulEntryField>
        ) : null}
      </p>
      <ContentfulEntryField field="label">
        <p className="mt-2 text-sm text-subtle">{label}</p>
      </ContentfulEntryField>
    </div>
  );
}