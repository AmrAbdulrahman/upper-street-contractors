import { ZeroCmsEntry, ZeroCmsEntryField } from "@usc/zero-cms-widget";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { Icon } from "@/components/ui/icon";
import { query } from "@/lib/cms/query";
import { GlanceCard } from "./glance-card";
import { GetAtAGlanceDocument } from "@/generated/graphql";

function formatGlanceValue(quantity: number | null | undefined): string {
  return quantity == null ? "" : String(quantity);
}

export default async function AtAGlance() {
  const data = await query(GetAtAGlanceDocument);
  const glance = data.atAglances[0] ?? null;
  if (!glance) return null;

  const cards = glance.cards?.filter(Boolean) ?? [];

  return (
    <ZeroCmsEntry entry={glance}>
      <aside className="w-full max-w-md rounded-xl border border-white/10 bg-[rgba(255,255,255,0.06)] p-6 shadow-lg backdrop-blur-sm lg:max-w-none">
        {glance.title ? (
          <ZeroCmsEntryField field="title">
            <p className="text-xs font-medium tracking-[0.1em] text-subtle uppercase">
              {glance.title}
            </p>
          </ZeroCmsEntryField>
        ) : null}

        {cards.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {cards.map((card) => (
              <ZeroCmsEntry key={card.id} entry={card}>
                <GlanceCard
                  value={formatGlanceValue(card.quantity)}
                  valueAccent={card.unit}
                  label={card.label ?? ""}
                />
              </ZeroCmsEntry>
            ))}
          </div>
        ) : null}

        {glance.footer ? (
          <ZeroCmsEntryField field="footer" className="min-w-0 flex-1">
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-gold/40 bg-gold-mid/15 px-4 py-3.5">
              <Icon
                data={{ code: "shield" }}
                className="mt-0.5 h-5 w-5 shrink-0 text-gold"
              />
              <RichTextViewer content={glance.footer} variant="at-a-glance-footer" />
            </div>
          </ZeroCmsEntryField>
        ) : null}
      </aside>
    </ZeroCmsEntry>
  );
}
