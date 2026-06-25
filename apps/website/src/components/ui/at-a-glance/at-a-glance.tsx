import { AddStrapiEntry, StrapiEntry, StrapiEntryField } from "@/components/strapi";
import { RichText } from "@/components/strapi/rich-text";
import { Icon } from "@/components/ui/icon";
import { GetAtAGlanceDocument, type GetAtAGlanceQuery } from "@/generated/graphql";
import { strapiRead } from "@/lib/strapi-read";
import { GlanceCard } from "./glance-card";

function formatGlanceValue(quantity: number | null | undefined): string {
  if (quantity == null) {
    return "";
  }

  return String(quantity);
}

export default async function AtAGlance() {
  const data = await strapiRead<GetAtAGlanceQuery>(GetAtAGlanceDocument);
  const glance = data?.atAglance ?? null;

  if (!glance) {
    return null;
  }

  const cards = glance.cards?.filter(Boolean) ?? [];

  return (
    <StrapiEntry entry={glance}>
      <aside className="w-full max-w-md rounded-xl border border-white/10 bg-[rgba(255,255,255,0.06)] p-6 shadow-lg backdrop-blur-sm lg:max-w-none">
        {glance.title ? (
          <StrapiEntryField field="title">
            <p className="text-xs font-medium tracking-[0.1em] text-subtle uppercase">
              {glance.title}
            </p>
          </StrapiEntryField>
        ) : null}

        {cards.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {cards.map((card) =>
              card ? (
                <StrapiEntry key={card.documentId} entry={card}>
                  <GlanceCard
                    value={formatGlanceValue(card.quantity)}
                    valueAccent={card.unit}
                    label={card.label ?? ""}
                  />
                </StrapiEntry>
              ) : null,
            )}

            <AddStrapiEntry field="cards" />
          </div>
        ) : null}

        {glance.footer ? (
          <StrapiEntryField field="footer" className="min-w-0 flex-1">
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-gold/40 bg-gold-mid/15 px-4 py-3.5">
              <Icon
                data={{ code: "shield" }}
                className="mt-0.5 h-5 w-5 shrink-0 text-gold"
              />
              <RichText content={glance.footer} variant="at-a-glance-footer" />
            </div>
          </StrapiEntryField>
        ) : null}
      </aside>
    </StrapiEntry>
  );
}
