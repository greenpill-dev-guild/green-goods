import {
  type Address,
  getNetworkContracts,
  isZeroAddress,
  SUPPORTED_CHAINS,
  toastService,
  useAdminStore,
  useOpsFinalizeUpgrade,
  useOpsJobLogs,
  useOpsRunnerAuth,
  useOpsRunnerHealth,
  useOpsRunnerJob,
  useOpsRunnerJobs,
  useOpsRunnerSession,
  useOpsUpgradePlan,
} from "@green-goods/shared";
import * as Tabs from "@radix-ui/react-tabs";
import {
  RiExternalLinkLine,
  RiRefreshLine,
  RiSettings3Line,
  RiToolsLine,
  RiUploadLine,
} from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { useAccount, useSignMessage } from "wagmi";
import { AddressDisplay } from "@/components/AddressDisplay";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
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

export default function Contracts() {
  const { formatMessage } = useIntl();
  const selectedChainId = useAdminStore((s) => s.selectedChainId);
  const network = chainIdToOpsNetwork(selectedChainId);

  const contracts = getNetworkContracts(selectedChainId);
  const chains = Object.values(SUPPORTED_CHAINS);
  const currentChain = chains.find((c) => c.id === selectedChainId);

  const explorerUrl = currentChain?.blockExplorers?.default?.url;

  const contractList = [
    { name: "Garden Token", address: contracts.gardenToken, type: "core" },
    { name: "Action Registry", address: contracts.actionRegistry, type: "core" },
    { name: "Work Resolver", address: contracts.workResolver, type: "resolver" },
    { name: "Work Approval Resolver", address: contracts.workApprovalResolver, type: "resolver" },
    { name: "Deployment Registry", address: contracts.deploymentRegistry, type: "registry" },
    { name: "EAS", address: contracts.eas, type: "external" },
    { name: "EAS Schema Registry", address: contracts.easSchemaRegistry, type: "external" },
    { name: "Community Token", address: contracts.communityToken, type: "token" },
  ];

  const getStatusText = (address: Address) => {
    if (isZeroAddress(address)) {
      return formatMessage({
        id: "app.contracts.status.notDeployed",
        defaultMessage: "Not Deployed",
      });
    }
    return formatMessage({ id: "app.contracts.status.deployed", defaultMessage: "Deployed" });
  };

  const { address: walletAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { session, isAuthenticated, clearSession } = useOpsRunnerSession();
  const auth = useOpsRunnerAuth();
  const health = useOpsRunnerHealth();
  const upgradePlanMutation = useOpsUpgradePlan();
  const finalizeUpgradeMutation = useOpsFinalizeUpgrade();
  const jobsQuery = useOpsRunnerJobs({ enabled: isAuthenticated, refetchIntervalMs: 3_000 });

  const [sender, setSender] = useState("");
  const [upgradeTarget, setUpgradeTarget] =
    useState<(typeof UPGRADE_CONTRACT_OPTIONS)[number]>("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

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
    return jobs.find((job) => job.id === selectedJobId) ?? null;
  }, [jobs, selectedJobId, selectedJobQuery.data]);

  const connectRunner = async () => {
    if (!walletAddress) {
      toastService.error({ title: formatMessage({ id: "app.deployment.ops.connectWalletFirst" }) });
      return;
    }

    try {
      const challenge = await auth.requestChallenge.mutateAsync({ address: walletAddress });
      const signature = await signMessageAsync({ message: challenge.message });
      await auth.verifySignature.mutateAsync({ address: walletAddress, signature });
      toastService.success({ title: formatMessage({ id: "app.deployment.ops.authSuccess" }) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" });
      toastService.error({
        title: formatMessage({ id: "app.deployment.ops.authFailed" }),
        description: message,
      });
    }
  };

  const runUpgradePlan = async () => {
    if (!isAuthenticated) {
      toastService.error({ title: formatMessage({ id: "app.contracts.upgrade.authRequired" }) });
      return;
    }

    try {
      const job = await upgradePlanMutation.mutateAsync({
        network,
        contract: upgradeTarget,
        sender: sender.trim() || undefined,
      });
      setSelectedJobId(job.id);
      toastService.success({ title: formatMessage({ id: "app.contracts.upgrade.jobStarted" }) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" });
      toastService.error({
        title: formatMessage({ id: "app.contracts.upgrade.submitFailed" }),
        description: message,
      });
    }
  };

  const runUpgradeFinalize = async () => {
    if (!isAuthenticated) {
      toastService.error({ title: formatMessage({ id: "app.contracts.upgrade.authRequired" }) });
      return;
    }

    try {
      const job = await finalizeUpgradeMutation.mutateAsync({
        network,
        contract: upgradeTarget,
        sender: sender.trim() || undefined,
      });
      setSelectedJobId(job.id);
      toastService.success({ title: formatMessage({ id: "app.contracts.upgrade.jobStarted" }) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" });
      toastService.error({
        title: formatMessage({ id: "app.contracts.upgrade.submitFailed" }),
        description: message,
      });
    }
  };

  return (
    <div>
      <PageHeader
        title={formatMessage({ id: "app.contracts.title", defaultMessage: "Contracts" })}
        description={formatMessage(
          {
            id: "app.contracts.description",
            defaultMessage: "View and manage deployed contracts on {chain}.",
          },
          { chain: currentChain?.name }
        )}
        sticky
      />

      <div className="p-6">
        <Tabs.Root defaultValue="deployed">
          <Tabs.List className="border-b border-stroke-soft mb-8 -mb-px flex space-x-8">
            <Tabs.Trigger
              value="deployed"
              className="flex items-center py-3 px-1 border-b-2 border-transparent font-medium text-sm text-text-soft hover:text-text-sub hover:border-stroke-sub transition-colors data-[state=active]:border-primary-base data-[state=active]:text-primary-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
            >
              <RiSettings3Line className="mr-2 h-4 w-4" />
              {formatMessage({
                id: "app.contracts.tabs.deployed",
                defaultMessage: "Deployed Contracts",
              })}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="deploy"
              className="flex items-center py-3 px-1 border-b-2 border-transparent font-medium text-sm text-text-soft hover:text-text-sub hover:border-stroke-sub transition-colors data-[state=active]:border-primary-base data-[state=active]:text-primary-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
            >
              <RiUploadLine className="mr-2 h-4 w-4" />
              {formatMessage({ id: "app.contracts.tabs.deployNew", defaultMessage: "Deploy New" })}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="upgrade"
              className="flex items-center py-3 px-1 border-b-2 border-transparent font-medium text-sm text-text-soft hover:text-text-sub hover:border-stroke-sub transition-colors data-[state=active]:border-primary-base data-[state=active]:text-primary-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
            >
              <RiRefreshLine className="mr-2 h-4 w-4" />
              {formatMessage({ id: "app.contracts.tabs.upgrade", defaultMessage: "Upgrade" })}
            </Tabs.Trigger>
          </Tabs.List>

          {/* Deployed Contracts */}
          <Tabs.Content value="deployed">
            <Card colorAccent="primary">
              <Card.Header className="flex-col items-start">
                <h2 className="text-lg font-medium text-text-strong">
                  {formatMessage({
                    id: "app.contracts.tabs.deployed",
                    defaultMessage: "Deployed Contracts",
                  })}
                </h2>
                <p className="text-sm text-text-sub mt-1">
                  {formatMessage(
                    {
                      id: "app.contracts.deployed.description",
                      defaultMessage: "Contracts deployed on {chain}.",
                    },
                    { chain: currentChain?.name }
                  )}
                </p>
              </Card.Header>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-full divide-y divide-stroke-soft">
                  <thead className="bg-bg-weak">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-text-soft uppercase tracking-wider"
                      >
                        {formatMessage({
                          id: "app.contracts.table.contract",
                          defaultMessage: "Contract",
                        })}
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-text-soft uppercase tracking-wider"
                      >
                        {formatMessage({ id: "app.contracts.table.type", defaultMessage: "Type" })}
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-text-soft uppercase tracking-wider"
                      >
                        {formatMessage({
                          id: "app.contracts.table.address",
                          defaultMessage: "Address",
                        })}
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-text-soft uppercase tracking-wider"
                      >
                        {formatMessage({
                          id: "app.contracts.table.status",
                          defaultMessage: "Status",
                        })}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-bg-white divide-y divide-stroke-soft">
                    {contractList.map((contract) => (
                      <tr key={contract.name}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-strong">
                          {contract.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-soft capitalize">
                          {contract.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <AddressDisplay address={contract.address} />
                            {explorerUrl && !isZeroAddress(contract.address) && (
                              <a
                                href={`${explorerUrl}/address/${contract.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-text-soft hover:text-primary-base transition-colors"
                                title={formatMessage({
                                  id: "app.contracts.viewOnExplorer",
                                  defaultMessage: "View on explorer",
                                })}
                              >
                                <RiExternalLinkLine className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge
                            variant={isZeroAddress(contract.address) ? "error" : "success"}
                            size="sm"
                          >
                            {getStatusText(contract.address)}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="space-y-3 p-4 sm:hidden">
                {contractList.map((contract) => (
                  <div
                    key={contract.name}
                    className="rounded-lg border border-stroke-soft bg-bg-weak p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-text-strong">{contract.name}</span>
                      <StatusBadge
                        variant={isZeroAddress(contract.address) ? "error" : "success"}
                        size="sm"
                      >
                        {getStatusText(contract.address)}
                      </StatusBadge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-soft">
                          {formatMessage({
                            id: "app.contracts.table.type",
                            defaultMessage: "Type",
                          })}
                        </span>
                        <span className="font-medium text-text-strong capitalize">
                          {contract.type}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-text-soft">
                          {formatMessage({
                            id: "app.contracts.table.address",
                            defaultMessage: "Address",
                          })}
                        </span>
                        <div className="flex items-center gap-1">
                          <AddressDisplay address={contract.address} />
                          {explorerUrl && !isZeroAddress(contract.address) && (
                            <a
                              href={`${explorerUrl}/address/${contract.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-text-soft hover:text-primary-base transition-colors"
                            >
                              <RiExternalLinkLine className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Tabs.Content>

          {/* Deploy New */}
          <Tabs.Content value="deploy">
            <Card colorAccent="primary">
              <Card.Header className="flex-col items-start">
                <h2 className="text-lg font-medium text-text-strong">
                  {formatMessage({
                    id: "app.contracts.deploy.title",
                    defaultMessage: "Deploy New Contracts",
                  })}
                </h2>
                <p className="text-sm text-text-sub mt-1">
                  {formatMessage(
                    {
                      id: "app.contracts.deploy.description",
                      defaultMessage: "Deploy new contracts to {chain}.",
                    },
                    { chain: currentChain?.name }
                  )}
                </p>
              </Card.Header>
              <Card.Body>
                <div className="text-center py-8 space-y-3">
                  <RiToolsLine className="mx-auto h-12 w-12 text-text-soft" />
                  <p className="text-sm text-text-soft">
                    {formatMessage({ id: "app.contracts.deploy.openDeploymentPage" })}
                  </p>
                  <Button asChild>
                    <Link to="/deployment">{formatMessage({ id: "app.deployment.title" })}</Link>
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Tabs.Content>

          {/* Upgrade */}
          <Tabs.Content value="upgrade">
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
                    { chain: currentChain?.name }
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
                    <Button
                      type="button"
                      onClick={connectRunner}
                      loading={auth.requestChallenge.isPending || auth.verifySignature.isPending}
                    >
                      {formatMessage({ id: "app.deployment.ops.authenticate" })}
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" onClick={clearSession}>
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
                    onClick={runUpgradePlan}
                    loading={upgradePlanMutation.isPending}
                    disabled={!isAuthenticated}
                  >
                    {formatMessage({ id: "app.contracts.upgrade.generatePlan" })}
                  </Button>
                  <Button
                    type="button"
                    onClick={runUpgradeFinalize}
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
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
