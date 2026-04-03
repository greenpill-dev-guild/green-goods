import {
  type Address,
  getChain,
  trackAdminDeploySuccess,
  useAdminStore,
  useDeploymentRegistry,
  useOpenMinting,
  useOpsDeployPlan,
  useOpsFinalizeDeploy,
  useOpsJobLogs,
  useOpsRunnerConnect,
  useOpsRunnerHealth,
  useOpsRunnerJob,
  useOpsRunnerJobs,
  useOpsRunnerScripts,
  useOpsRunScript,
  useSetOpenMinting,
} from "@green-goods/shared";
import { RiErrorWarningLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useAccount, useSignMessage } from "wagmi";
import { PageHeader } from "@/components/Layout/PageHeader";
import { chainIdToOpsNetwork } from "@/utils/ops";
import { DeploymentAllowlistManager } from "./DeploymentAllowlistManager";
import { DeploymentJobMonitor } from "./DeploymentJobMonitor";
import { DeploymentRunnerPanel } from "./DeploymentRunnerPanel";
export default function Deployment() {
  const { formatMessage } = useIntl();
  const selectedChainId = useAdminStore((s) => s.selectedChainId);
  const permissions = useDeploymentRegistry();
  const chain = getChain(selectedChainId);
  const network = chainIdToOpsNetwork(selectedChainId);
  const { address: walletAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { connect, disconnect, isConnecting, isAuthenticated, session } = useOpsRunnerConnect({
    walletAddress,
    signMessageAsync,
  });
  const opsHealth = useOpsRunnerHealth();
  const jobsQuery = useOpsRunnerJobs({
    enabled: permissions.canDeploy && isAuthenticated,
    refetchIntervalMs: 3_000,
  });
  const scriptsQuery = useOpsRunnerScripts();
  const runScriptMutation = useOpsRunScript();
  const deployPlanMutation = useOpsDeployPlan();
  const finalizeDeployMutation = useOpsFinalizeDeploy();
  const openMintingQuery = useOpenMinting();
  const setOpenMintingMutation = useSetOpenMinting();
  const [sender, setSender] = useState("");
  const [deploymentSalt, setDeploymentSalt] = useState("");
  const [updateSchemasOnly, setUpdateSchemasOnly] = useState(false);
  const [forceRedeploy, setForceRedeploy] = useState(false);
  const [syncEnvio, setSyncEnvio] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [trackedSuccessJobId, setTrackedSuccessJobId] = useState<string | null>(null);
  const selectedJobQuery = useOpsRunnerJob(selectedJobId, {
    enabled: !!selectedJobId && isAuthenticated,
  });
  const jobLogs = useOpsJobLogs(selectedJobId, {
    enabled: !!selectedJobId && isAuthenticated,
    maxLogs: 1_200,
  });
  useEffect(() => {
    if (!walletAddress || sender.trim()) return;
    setSender(walletAddress);
  }, [walletAddress, sender]);
  const recentJobs = jobsQuery.data ?? [];
  const currentJob = useMemo(() => {
    if (selectedJobQuery.data) return selectedJobQuery.data;
    return (jobsQuery.data ?? []).find((job) => job.id === selectedJobId) ?? null;
  }, [jobsQuery.data, selectedJobId, selectedJobQuery.data]);
  useEffect(() => {
    if (!currentJob || currentJob.status !== "succeeded" || currentJob.id === trackedSuccessJobId)
      return;
    if (currentJob.type !== "finalize-deploy") return;
    const txHashes = Array.isArray(currentJob.result?.transactionHashes)
      ? currentJob.result.transactionHashes
      : [];
    trackAdminDeploySuccess({
      chainId: selectedChainId,
      contractType: "green-goods-core",
      contractAddress: String(currentJob.result?.deploymentArtifactPath ?? ""),
      txHash: typeof txHashes[0] === "string" ? txHashes[0] : "",
    });
    setTrackedSuccessJobId(currentJob.id);
  }, [currentJob, selectedChainId, trackedSuccessJobId]);
  if (!permissions.isOwner && !permissions.isInAllowlist) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <RiErrorWarningLine className="mx-auto h-12 w-12 text-error-base" />
          <h3 className="mt-2 text-sm font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.accessDenied" })}
          </h3>
          <p className="mt-1 text-sm text-text-soft">
            {formatMessage({ id: "app.deployment.accessDeniedDescription" })}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <PageHeader
        title={formatMessage({ id: "app.deployment.title" })}
        description={formatMessage({ id: "app.deployment.description" }, { chain: chain.name })}
        sticky
      />
      <div className="p-6 space-y-6">
        <DeploymentRunnerPanel
          formatMessage={formatMessage}
          selectedChainId={selectedChainId}
          network={network}
          permissions={permissions}
          isAuthenticated={isAuthenticated}
          sessionAddress={(session?.address as Address | null | undefined) ?? null}
          connect={connect}
          disconnect={disconnect}
          isConnecting={isConnecting}
          runnerOnline={!!opsHealth.data?.ok}
          scripts={scriptsQuery.data ?? []}
          scriptsLoading={scriptsQuery.isLoading}
          runScriptPending={runScriptMutation.isPending}
          runScript={(scriptId) => runScriptMutation.mutateAsync({ scriptId, network })}
          sender={sender}
          setSender={setSender}
          deploymentSalt={deploymentSalt}
          setDeploymentSalt={setDeploymentSalt}
          updateSchemasOnly={updateSchemasOnly}
          setUpdateSchemasOnly={setUpdateSchemasOnly}
          forceRedeploy={forceRedeploy}
          setForceRedeploy={setForceRedeploy}
          syncEnvio={syncEnvio}
          setSyncEnvio={setSyncEnvio}
          deployPlanPending={deployPlanMutation.isPending}
          runDeployPlan={deployPlanMutation.mutateAsync}
          finalizeDeployPending={finalizeDeployMutation.isPending}
          runDeployFinalize={finalizeDeployMutation.mutateAsync}
          setSelectedJobId={setSelectedJobId}
          allowlistManager={
            permissions.isOwner ? <DeploymentAllowlistManager chainId={selectedChainId} /> : null
          }
          jobMonitor={
            <DeploymentJobMonitor
              formatMessage={formatMessage}
              selectedJobId={selectedJobId}
              setSelectedJobId={setSelectedJobId}
              recentJobs={recentJobs}
              currentJob={currentJob}
              jobLogs={jobLogs}
            />
          }
          isOpenMinting={openMintingQuery.data}
          openMintingLoading={openMintingQuery.isLoading}
          setOpenMintingPending={setOpenMintingMutation.isPending}
          setOpenMinting={(isOpen) => setOpenMintingMutation.mutate(isOpen)}
        />
      </div>
    </div>
  );
}
