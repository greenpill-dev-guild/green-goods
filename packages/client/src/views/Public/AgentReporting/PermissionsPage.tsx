import { useAgentReportingPermissions } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingPermissions";
import PublicWalletRuntimeProviders from "@/components/Public/PublicWalletRuntimeProviders";
import { PermissionsView } from "./PermissionsView";

function Permissions() {
  return <PermissionsView {...useAgentReportingPermissions()} />;
}

/** Owner permission management remains available without a chat link or Agent session. */
export default function () {
  return (
    <PublicWalletRuntimeProviders analyticsIdentity={false}>
      <Permissions />
    </PublicWalletRuntimeProviders>
  );
}
