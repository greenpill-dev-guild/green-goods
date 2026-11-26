import { useAgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import { useAgentReportingRecovery } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingRecovery";
import { useParams } from "react-router-dom";
import PublicWalletRuntimeProviders from "@/components/Public/PublicWalletRuntimeProviders";
import { CeremonyView } from "./CeremonyView";
import { RecoveryView } from "./RecoveryView";

/**
 * Chat continuation pages. The wallet runtime loads only here, without analytics identity, so a
 * chat conversation is never tied to a wallet in telemetry.
 */
function Ceremony({ requestId }: { requestId: string }) {
  return <CeremonyView {...useAgentReportingCeremony(requestId)} />;
}

function Recovery({ requestId }: { requestId: string }) {
  return <RecoveryView {...useAgentReportingRecovery(requestId)} />;
}

export function ReportingCeremonyPage() {
  const { requestId = "" } = useParams();
  return (
    <PublicWalletRuntimeProviders analyticsIdentity={false}>
      <Ceremony key={requestId} requestId={requestId} />
    </PublicWalletRuntimeProviders>
  );
}

export function ReportingRecoveryPage() {
  const { requestId = "" } = useParams();
  return (
    <PublicWalletRuntimeProviders analyticsIdentity={false}>
      <Recovery key={requestId} requestId={requestId} />
    </PublicWalletRuntimeProviders>
  );
}
