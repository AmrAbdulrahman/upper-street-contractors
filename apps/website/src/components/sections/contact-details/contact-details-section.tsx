import "server-only";

import { getSiteMetaConfig } from "@/components/site-meta-config";
import { resolveWhatsAppUrl } from "@/helpers";
import { ContactDetailsPanel, type ContactDetailsProps } from "./contact-details";

/**
 * Standalone section wrapper — Contact Details placed on a page in its own
 * right, rather than as a column beside the Enquiry Wizard.
 *
 * Split out of `contact-details.tsx` so that file stays importable from the
 * wizard, which is a Client Component: this one reads the CMS to resolve the
 * WhatsApp destination, and a single such import in the shared module pulls
 * `zero-cms-core/node` into the browser bundle and fails the build.
 */
export async function ContactDetailsSection({ data }: ContactDetailsProps) {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-container px-6 py-[72px]">
        <div className="max-w-md">
          <ContactDetailsPanel
            data={data}
            whatsappUrl={resolveWhatsAppUrl(await getSiteMetaConfig())}
          />
        </div>
      </div>
    </section>
  );
}
