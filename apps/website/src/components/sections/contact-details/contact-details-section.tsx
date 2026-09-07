import { ContactDetailsPanel, type ContactDetailsProps } from "./contact-details";

/**
 * Standalone section wrapper — Contact Details placed on a page in its own
 * right, rather than as a column beside the Enquiry Wizard.
 *
 * It used to read the CMS here for the panel's WhatsApp destination, which is
 * why it is a separate file from `contact-details.tsx` at all: that module is
 * imported by the wizard, a Client Component, and one `getSiteMetaConfig` in it
 * pulls `zero-cms-core/node` into the browser bundle and fails the build. The
 * panel has no WhatsApp button any more and this wrapper needs nothing from the
 * CMS, but the split stays — the boundary it protects has not moved.
 */
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
