// `<CmsButton>` is gone. It existed to resolve the `whatsapp` action's
// destination server-side, and there is no such action any more — the pinned
// Quick Contact tab is the site's one WhatsApp affordance. `Button` resolves
// everything it needs from its own data, so every caller uses it directly and
// this entry point stays safe for the Enquiry Wizard's Client Components.
export {
  Button,
  BUTTON_ACTIONS,
  BUTTON_COLORS,
  BUTTON_VARIANTS,
  ICON_POSITIONS,
  isExternalHref,
  normalizeButtonAction,
  normalizeButtonColor,
  normalizeButtonVariant,
  normalizeIconPosition,
  type ButtonAction,
  type ButtonColor,
  type ButtonData,
  type ButtonProps,
  type ButtonVariant,
  type IconPosition,
} from "./button";
