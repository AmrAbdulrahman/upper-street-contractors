import type { SiteMetaConfigFragment } from "@/generated/graphql";
import { getWhatsAppUrl } from "@/helpers/whatsapp-url";

/**
 * The one WhatsApp destination for the whole site — header, footer, Quick
 * Contact widget and every CMS Button carrying the `whatsapp` action.
 *
 * Order matters: the `socialLinks` entry wins over `phoneNumber` because the
 * number people message is not always the number they ring (here it is a mobile
 * against an 020 landline, and only one of the two is registered to WhatsApp).
 *
 * The stored URL is normalised rather than passed through. It reaches us as
 * whatever an editor typed — `http://wa.me/…` is what is stored today — and it
 * is emitted into the page, into `mailto`-adjacent chrome and into the
 * LocalBusiness JSON-LD `sameAs` array, so an insecure scheme there is a
 * mixed-content link and a structured-data claim about the business at once.
 */
export function resolveWhatsAppUrl(
  config: SiteMetaConfigFragment | null,
): string | null {
  const socialWhatsapp = config?.socialLinks?.find((item) =>
    item?.socialNetworkName?.toLowerCase().includes("whatsapp"),
  )?.url;

  if (socialWhatsapp) {
    return normalizeWhatsAppUrl(socialWhatsapp);
  }

  if (config?.phoneNumber) {
    return getWhatsAppUrl(config.phoneNumber);
  }

  return null;
}

/**
 * Force `https` and rebuild a `wa.me` link from its digits, so a stored
 * `http://wa.me/447588376345` and a stored `+44 7588 376345` produce the same
 * canonical URL. Anything that is not a recognisable wa.me link is only
 * upgraded to `https`, never rewritten — an editor may legitimately point at
 * `api.whatsapp.com` with a prefilled message.
 */
function normalizeWhatsAppUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const secure = trimmed.replace(/^http:\/\//i, "https://");
  const waMe = /^https:\/\/(?:www\.)?wa\.me\/(\+?[\d\s-]+)$/i.exec(secure);

  return waMe?.[1] ? getWhatsAppUrl(waMe[1]) : secure;
}
