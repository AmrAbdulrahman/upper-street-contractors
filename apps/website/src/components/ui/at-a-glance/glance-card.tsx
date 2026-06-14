import { StrapiEntryField } from "@/components/strapi/strapi-entry-field";

export type GlanceCardProps = {
  value: string;
  valueAccent?: string | null;
  label: string;
};

export function GlanceCard({ value, valueAccent, label }: GlanceCardProps) {
  return (
    <div className="rounded-lg border border-white/5 bg-[rgba(255,255,255,0.06)] px-5 py-4">
      <p className="font-serif text-3xl leading-none tracking-tight text-white">
        <StrapiEntryField field="quantity" as="span">
          <span>{value}</span>
        </StrapiEntryField>

        {valueAccent ? (
          <StrapiEntryField field="unit" as="span">
            <span className="text-gold-mid">{valueAccent}</span>
          </StrapiEntryField>
        ) : null}
      </p>
      <StrapiEntryField field="label">
        <p className="mt-2 text-sm text-subtle">{label}</p>
      </StrapiEntryField>
    </div>
  );
}