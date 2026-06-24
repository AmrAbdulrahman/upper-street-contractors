import { isLoginGateBuildEnabled } from "@/helpers/preview-utils";
import { hasSession } from "@/lib/auth/session";
import { LoginScreen } from "./login-screen";
import { RefreshScheduler } from "./refresh-scheduler";

type LoginGateShellProps = {
  children: React.ReactNode;
};

// Staging login lock, mirroring ColdStartGateShell. On preview builds with no
// editor session it renders the LoginScreen *instead of* children, so the gated
// subtree's Strapi reads never run. With a session, children render unchanged
// and the refresh scheduler keeps the access token fresh. On production
// (gate disabled) it's a passthrough and never reads cookies, so pages stay static.
export async function LoginGateShell({ children }: LoginGateShellProps) {
  if (!isLoginGateBuildEnabled()) {
    return children;
  }

  if (await hasSession()) {
    return (
      <>
        {children}
        <RefreshScheduler />
      </>
    );
  }

  return <LoginScreen />;
}
