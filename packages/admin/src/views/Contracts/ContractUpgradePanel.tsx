import {
  useOpsFinalizeUpgrade,
  useOpsJobLogs,
  useOpsJobRunner,
  useOpsRunnerConnect,
  useOpsRunnerHealth,
  useOpsRunnerJob,
  useOpsRunnerJobs,
  useOpsUpgradePlan,
} from "@green-goods/shared";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useAccount, useSignMessage } from "wagmi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { chainIdToOpsNetwork, getOpsStatusBadge } from "@/utils/ops";

const UPGRADE_CONTRACT_OPTIONS = [
  "all",
  "action-registry",
  "garden-token",
  "gardener-account",
  "octant-module",
  "work-resolver",
  "work-approval-resolver",
  "assessment-resolver",
  "deployment-registry",
] as const;

interface ContractUpgradePanelProps {
  selectedChainId: number;
  chainName?: string;
}

export function ContractUpgradePanel({ selectedChainId, chainName }: ContractUpgradePanelProps) {
  const { formatMessage } = useIntl();
  const network = chainIdToOpsNetwork(selectedChainId);

  const { address: walletAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { connect, disconnect, isConnecting, isAuthenticated, session } = useOpsRunnerConnect({
    walletAddress,
    signMessageAsync,
  });
  const health = useOpsRunnerHealth();
  const upgradePlanMutation = useOpsUpgradePlan();
  const finalizeUpgradeMutation = useOpsFinalizeUpgrade();
  const jobsQuery = useOpsRunnerJobs({ enabled: isAuthenticated, refetchIntervalMs: 3_000 });

  const [sender, setSender] = useState("");
  const [upgradeTarget, setUpgradeTarget] =
    useState<(typeof UPGRADE_CONTRACT_OPTIONS)[number]>("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { runJob } = useOpsJobRunner({
    onJobStarted: (jobId) => setSelectedJobId(jobId),
    successMessageId: "app.contracts.upgrade.jobStarted",
    failedMessageId: "app.contracts.upgrade.submitFailed",
    authRequiredMessageId: "app.contracts.upgrade.authRequired",
  });

  const selectedJobQuery = useOpsRunnerJob(selectedJobId, {
    enabled: !!selectedJobId && isAuthenticated,
  });

  const jobLogs = useOpsJobLogs(selectedJobId, {
    enabled: !!selectedJobId && isAuthenticated,
    maxLogs: 1_200,
  });

  useEffect(() => {
    if (!walletAddress) return;
    if (sender.trim()) return;
    setSender(walletAddress);
  }, [walletAddress, sender]);

  const jobs = jobsQuery.data ?? [];
  const currentJob = useMemo(() => {
    if (selectedJobQuery.data) {
      return selectedJobQuery.data;
    }
    return (jobsQuery.data ?? []).find((job) => job.id === selectedJobId) ?? null;
  }, [jobsQuery.data, selectedJobId, selectedJobQuery.data]);

  return (
    <Card colorAccent="primary">
      <Card.Header className="flex-col items-start">
        <h2 className="text-lg font-medium text-text-strong">
          {formatMessage({
            id: "app.contracts.upgrade.title",
            defaultMessage: "Upgrade Contracts",
          })}
        </h2>
        <p className="text-sm text-text-sub mt-1">
          {formatMessage(
            {
              id: "app.contracts.upgrade.description",
              defaultMessage: "Upgrade existing contracts on {chain}.",
            },
            { chain: chainName }
          )}
        </p>
      </Card.Header>
      <Card.Body className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`text-sm font-medium ${
              health.data?.ok ? "text-success-base" : "text-error-base"
            }`}
          >
            {health.data?.ok
              ? formatMessage({ id: "app.deployment.ops.runnerOnline" })
              : formatMessage({ id: "app.deployment.ops.runnerOffline" })}
          </span>

          {!isAuthenticated ? (
            <Button type="button" onClick={connect} loading={isConnecting}>
              {formatMessage({ id: "app.deployment.ops.authenticate" })}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={disconnect}>
              {formatMessage({ id: "app.deployment.ops.disconnect" })}
            </Button>
          )}

          {session?.address && (
            <span className="text-xs text-text-soft">{session.address}</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              className="block text-sm font-medium text-text-strong mb-1"
              htmlFor="upgradeTarget"
            >
              {formatMessage({ id: "app.contracts.upgrade.selectContract" })}
            </label>
            <select
              id="upgradeTarget"
              value={upgradeTarget}
              onChange={(event) =>
                setUpgradeTarget(
                  event.target.value as (typeof UPGRADE_CONTRACT_OPTIONS)[number]
                )
              }
              className="w-full px-3 py-2 border border-stroke-sub bg-bg-white text-text-strong rounded-lg"
            >
              {UPGRADE_CONTRACT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-text-strong mb-1"
              htmlFor="upgradeSender"
            >
              {formatMessage({ id: "app.contracts.upgrade.senderLabel" })}
            </label>
            <input
              id="upgradeSender"
              type="text"
              value={sender}
              onChange={(event) => setSender(event.target.value)}
              className="w-full px-3 py-2 border border-stroke-sub bg-bg-white text-text-strong rounded-lg"
              placeholder="0x..."
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              runJob(upgradePlanMutation, {
                network,
                contract: upgradeTarget,
                sender: sender.trim() || undefined,
              })
            }
            loading={upgradePlanMutation.isPending}
            disabled={!isAuthenticated}
          >
            {formatMessage({ id: "app.contracts.upgrade.generatePlan" })}
          </Button>
          <Button
            type="button"
            onClick={() =>
              runJob(finalizeUpgradeMutation, {
                network,
                contract: upgradeTarget,
                sender: sender.trim() || undefined,
              })
            }
            loading={finalizeUpgradeMutation.isPending}
            disabled={!isAuthenticated}
          >
            {formatMessage({ id: "app.contracts.upgrade.executeUpgrade" })}
          </Button>
        </div>

        {!isAuthenticated && (
          <p className="text-sm text-error-base">
            {formatMessage({ id: "app.contracts.upgrade.authRequired" })}
          </p>
        )}

        <div className="space-y-3 border-t border-stroke-soft pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-strong">
              {formatMessage({ id: "app.contracts.upgrade.jobStatus" })}
            </h3>
            <select
              value={selectedJobId ?? ""}
              onChange={(event) => setSelectedJobId(event.target.value || null)}
              className="border border-stroke-sub rounded-lg px-2 py-1 text-sm bg-bg-white"
            >
              <option value="">
                {formatMessage({ id: "app.contracts.upgrade.selectJob" })}
              </option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.type} · {job.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>

          {!selectedJobId ? (
            <p className="text-sm text-text-soft">
              {formatMessage({ id: "app.contracts.upgrade.noJobs" })}
            </p>
          ) : (
            <>
              <p className="text-sm">
                <span
                  className={getOpsStatusBadge(
                    currentJob?.status ?? jobLogs.status?.status ?? "queued"
                  )}
                >
                  {formatMessage({
                    id: `app.deployment.ops.status.${currentJob?.status ?? jobLogs.status?.status ?? "queued"}`,
                  })}
                </span>
              </p>

              <div>
                <p className="text-sm font-medium text-text-strong mb-2">
                  {formatMessage({ id: "app.contracts.upgrade.logs" })}
                </p>
                <pre className="text-xs bg-bg-weak rounded-lg p-3 max-h-72 overflow-auto whitespace-pre-wrap">
                  {jobLogs.logs
                    .map((entry) => `${entry.at} [${entry.stream}] ${entry.message}`)
                    .join("\n")}
                </pre>
              </div>

              {currentJob?.result && (
                <div>
                  <p className="text-sm font-medium text-text-strong mb-2">
                    {formatMessage({ id: "app.contracts.upgrade.result" })}
                  </p>
                  <pre className="text-xs bg-bg-weak rounded-lg p-3 max-h-72 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(currentJob.result, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
