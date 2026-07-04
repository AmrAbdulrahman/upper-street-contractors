import {
  ZeroCmsEntry,
  ZeroCmsEntryField,
  ZeroCmsList,
  ZeroCmsRelationEntry,
} from "@usc/zero-cms-widget";
import { Button } from "@/components/ui/button";
import type { ContactDetailsSectionFragment } from "@/generated/graphql";

type ContactDetailsProps = { data: ContactDetailsSectionFragment };

/**
 * The dark "Get in touch directly" card. Rendered on its own by
 * <ContactDetailsSection> and as the right column of the Contact wizard.
 */
export function ContactDetailsPanel({ data }: ContactDetailsProps) {
  const { title, items, note, whatsappButton } = data;
  const detailItems = items?.filter(Boolean) ?? [];

  return (
    <ZeroCmsEntry entry={data}>
      <div className="rounded-3xl bg-dark p-7 text-white">
        {title ? (
          <ZeroCmsEntryField field="title">
            <h2 className="font-serif text-2xl text-white">{title}</h2>
          </ZeroCmsEntryField>
        ) : null}

        <ZeroCmsList className="mt-6 flex flex-col gap-5" field="items" items={detailItems}>
          {detailItems.map((item) =>
            item ? (
              <ZeroCmsEntry key={item.id} entry={item}>
                <div className="flex items-start gap-4">
                  {item.emoji ? (
                    <span
                      aria-hidden
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl"
                    >
                      {item.emoji}
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    {item.label ? (
                      <div className="text-[11px] font-bold tracking-[0.12em] text-subtle uppercase">
                        {item.label}
                      </div>
                    ) : null}
                    {item.text ? (
                      <div className="mt-0.5 whitespace-pre-line text-white">
                        {item.text}
                      </div>
                    ) : null}
                  </div>
                </div>
              </ZeroCmsEntry>
            ) : null,
          )}
        </ZeroCmsList>

        {note || whatsappButton ? (
          <div className="mt-7 rounded-2xl border border-whatsapp/25 bg-whatsapp/10 p-5">
            {note ? (
              <ZeroCmsEntryField field="note">
                <p className="text-sm leading-relaxed text-white/80">{note}</p>
              </ZeroCmsEntryField>
            ) : null}
            {whatsappButton ? (
              <div className="mt-4">
                <ZeroCmsRelationEntry entry={whatsappButton} field="whatsappButton">
                  <Button data={whatsappButton} className="w-full justify-center" />
                </ZeroCmsRelationEntry>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </ZeroCmsEntry>
  );
}

/** Standalone section wrapper (when Contact Details is used on its own). */
export function ContactDetailsSection({ data }: ContactDetailsProps) {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-container px-6 py-[72px]">
        <div className="max-w-md">
          <ContactDetailsPanel data={data} />
        </div>
      </div>
    </section>
  );
}
