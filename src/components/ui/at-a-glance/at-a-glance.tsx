import { AddContentfulEntry, ContentfulEntry, ContentfulEntryField } from "@/components/contentful";
import { RichText } from "@/components/contentful/rich-text";
import { Icon } from "@/components/ui/icon";
import { GetAtAGlanceDocument } from "@/generated/graphql";
import { getClient } from "@/lib/apollo-server";
import type { Document } from "@contentful/rich-text-types";
import { GlanceCard } from "./glance-card";

function formatGlanceValue(quantity: number | null | undefined): string {
  if (quantity == null) {
    return "";
  }

  return String(quantity);
}

export default async function AtAGlance() {
  const { data } = await getClient().query({
    query: GetAtAGlanceDocument,
  });

  const glance = data?.atAGlanceCollection?.items?.at(0) ?? null;

  if (!glance) {
    return null;
  }

  const footerDocument = glance.footer?.json as Document | undefined;
  const cards = glance.cardsCollection?.items?.filter(Boolean) ?? [];

  return (
    <ContentfulEntry entry={glance}>
      <aside className="w-full max-w-md rounded-xl border border-white/10 bg-[rgba(255,255,255,0.06)] p-6 shadow-lg backdrop-blur-sm lg:max-w-none">
        {glance.title ? (
          <ContentfulEntryField field="title">
            <p className="text-xs font-medium tracking-[0.1em] text-subtle uppercase">
              {glance.title}
            </p>
          </ContentfulEntryField>
        ) : null}

        {cards.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {cards.map((card) =>
              card ? (
                <ContentfulEntry key={card._id} entry={card}>
                  <GlanceCard
                    value={formatGlanceValue(card.quantity)}
                    valueAccent={card.unit}
                    label={card.label ?? ""}
                  />
                </ContentfulEntry>
              ) : null,
            )}

            <AddContentfulEntry field="cards" />
          </div>
        ) : null}

        {footerDocument ? (
            <ContentfulEntryField field="footer" className="min-w-0 flex-1">
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-gold/40 bg-gold-mid/15 px-4 py-3.5">
                <Icon data={{ code: 'shield' }} className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                <RichText
                  document={footerDocument}
                  variant="at-a-glance-footer"
                />
              </div>
            </ContentfulEntryField>
        ) : (
          null
        )}
      </aside>
    </ContentfulEntry>
  );
}
