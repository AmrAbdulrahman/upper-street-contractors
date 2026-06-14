import type { IconFragment } from "@/generated/graphql";
import type { IconCode } from "@/components/ui/icon/types";

export function iconData(code: IconCode): Pick<IconFragment, "code"> {
  return { code };
}
