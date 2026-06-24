import { isColdStartGateBuildEnabled } from "@/helpers/preview-utils";
import { ColdStartGate } from "./cold-start-gate";

type ColdStartGateShellProps = {
  children: React.ReactNode;
};

export function ColdStartGateShell({ children }: ColdStartGateShellProps) {
  if (!isColdStartGateBuildEnabled()) {
    return children;
  }

  return <ColdStartGate>{children}</ColdStartGate>;
}
