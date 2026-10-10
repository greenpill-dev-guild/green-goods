import { useAgentReportingPermissions } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingPermissions";
import WalletRuntimeProviders from "@/routes/WalletRuntimeProviders";
import { PermissionsView } from "./PermissionsView";

function Permissions() {
  return <PermissionsView {...useAgentReportingPermissions()} />;
}

/** Owner permission management remains available without a chat link or Agent session. */
export default function () {
  return (
    <WalletRuntimeProviders analyticsIdentity={false}>
      <Permissions />
    </WalletRuntimeProviders>
  );
}
