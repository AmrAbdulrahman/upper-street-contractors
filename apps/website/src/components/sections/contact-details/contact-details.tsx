import { ZeroCmsEntry, ZeroCmsEntryField, ZeroCmsList } from "@usc/zero-cms-widget";
import type { ContactDetailsSectionFragment } from "@/generated/graphql";

/**
 * This module is imported by the Enquiry Wizard, a Client Component, so it must
 * stay free of anything server-only. The standalone `<ContactDetailsSection>`
 * wrapper — which needs `getSiteMetaConfig` — therefore lives in its own file,
 * `contact-details-section.tsx`, and the barrel keeps the two apart.
 */
export type ContactDetailsProps = {
  data: ContactDetailsSectionFragment;
};

/**
 * The dark "Get in touch directly" card. Rendered on its own by
 * <ContactDetailsSection> and as the right column of the Contact wizard.
 */
export function ContactDetailsPanel({ data }: ContactDetailsProps) {
  const { title, items, note } = data;
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

        {/* The WhatsApp button that used to sit under this note is gone, along
            with the green tint that was there to frame it: the pinned Quick
            Contact tab is the site's one WhatsApp affordance now. The note
            itself is ordinary copy and keeps a neutral wash. */}
        {note ? (
          <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-5">
            <ZeroCmsEntryField field="note">
              <p className="text-sm leading-relaxed text-white/80">{note}</p>
            </ZeroCmsEntryField>
          </div>
        ) : null}
      </div>
    </ZeroCmsEntry>
  );
}

