import "server-only";

import { getSiteMetaConfig } from "@/components/site-meta-config";
import { resolveWhatsAppUrl } from "@/helpers";
import { Button, type ButtonProps } from "./button";

/**
 * A CMS Button that can resolve its own `whatsapp` action.
 *
 * This is the default choice everywhere on the server. It exists separately
 * from `<Button>` because `<Button>` must stay usable inside a Client Component
 * — the Enquiry Wizard renders the Contact Details panel, which renders a
 * Button — and one `getSiteMetaConfig()` call in that shared component pulls
 * the CMS query layer, and therefore `zero-cms-core/node`, into the browser
 * bundle. The build fails outright when it happens, so the split is enforced
 * rather than merely advised, and `import "server-only"` above makes the same
 * mistake here fail with a message that says why.
 *
 * The lookup is free: `getSiteMetaConfig` is `cache()`d per request and the
 * underlying read is revalidated on a 10-minute window, so N buttons on a page
 * cost one CMS call at most.
 */
export async function CmsButton(props: Omit<ButtonProps, "whatsappUrl">) {
  return <Button {...props} whatsappUrl={resolveWhatsAppUrl(await getSiteMetaConfig())} />;
}
