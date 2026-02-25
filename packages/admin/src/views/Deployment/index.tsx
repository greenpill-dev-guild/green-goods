import {
  DEPLOYMENT_REGISTRY_ABI,
  formatAddress,
  getChain,
  getNetworkContracts,
  logger,
  parseContractError,
  queryInvalidation,
  toastService,
  trackAdminDeployFailed,
  trackAdminDeployStarted,
  trackAdminDeploySuccess,
  useAdminStore,
  useDeploymentAllowlist,
  useDeploymentRegistry,
  useEnsAddress,
  useOpsDeployPlan,
  useOpsFinalizeDeploy,
  useOpsJobLogs,
  useOpsRunnerAuth,
  useOpsRunnerHealth,
  useOpsRunnerJob,
  useOpsRunnerJobs,
  useOpsRunnerSession,
  USER_FRIENDLY_ERRORS,
  type Address,
} from "@green-goods/shared";
import {
  RiClipboardLine,
  RiCodeBoxLine,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiGitBranchLine,
  RiSettings3Line,
  RiShieldCheckLine,
  RiUploadLine,
  RiUserAddLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";
import { useAccount, useConfig, useSignMessage, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { chainIdToOpsNetwork, getOpsStatusBadge } from "@/utils/ops";

export default function Deployment() {
  const { formatMessage } = useIntl();
  const selectedChainId = useAdminStore((s) => s.selectedChainId);
  const permissions = useDeploymentRegistry();
  const chain = getChain(selectedChainId);
  const network = chainIdToOpsNetwork(selectedChainId);

  const { address: walletAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const { session, isAuthenticated, clearSession } = useOpsRunnerSession();
  const opsAuth = useOpsRunnerAuth();
  const opsHealth = useOpsRunnerHealth();
  const jobsQuery = useOpsRunnerJobs({
    enabled: permissions.canDeploy && isAuthenticated,
    refetchIntervalMs: 3_000,
  });

  const deployPlanMutation = useOpsDeployPlan();
  const finalizeDeployMutation = useOpsFinalizeDeploy();

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
    if (!walletAddress) return;
    if (sender.trim()) return;
    setSender(walletAddress);
  }, [walletAddress, sender]);

  const recentJobs = jobsQuery.data ?? [];

  const currentJob = useMemo(() => {
    if (selectedJobQuery.data) {
      return selectedJobQuery.data;
    }
    return recentJobs.find((job) => job.id === selectedJobId) ?? null;
  }, [recentJobs, selectedJobId, selectedJobQuery.data]);

  const handleConnectRunner = async () => {
    if (!walletAddress) {
      toastService.error({
        title: formatMessage({ id: "app.deployment.ops.connectWalletFirst" }),
      });
      return;
    }

    try {
      const challenge = await opsAuth.requestChallenge.mutateAsync({ address: walletAddress });
      const signature = await signMessageAsync({ message: challenge.message });
      await opsAuth.verifySignature.mutateAsync({
        address: walletAddress,
        signature,
      });
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

  const buildDeployPayload = () => ({
    network,
    sender: sender.trim() || undefined,
    updateSchemasOnly,
    force: forceRedeploy,
    deploymentSalt: deploymentSalt.trim() || undefined,
    syncEnvio,
  });

  const runDeployPlan = async () => {
    if (!isAuthenticated) {
      toastService.error({ title: formatMessage({ id: "app.deployment.ops.authRequired" }) });
      return;
    }

    trackAdminDeployStarted({
      chainId: selectedChainId,
      contractType: "green-goods-core",
    });

    try {
      const job = await deployPlanMutation.mutateAsync(buildDeployPayload());
      setSelectedJobId(job.id);
      toastService.success({
        title: formatMessage({ id: "app.deployment.ops.jobStarted" }),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" });
      trackAdminDeployFailed({
        chainId: selectedChainId,
        contractType: "green-goods-core",
        error: message,
      });
      toastService.error({
        title: formatMessage({ id: "app.deployment.ops.submitFailed" }),
        description: message,
      });
    }
  };

  const runDeployFinalize = async () => {
    if (!isAuthenticated) {
      toastService.error({ title: formatMessage({ id: "app.deployment.ops.authRequired" }) });
      return;
    }

    trackAdminDeployStarted({
      chainId: selectedChainId,
      contractType: "green-goods-core",
    });

    try {
      const job = await finalizeDeployMutation.mutateAsync(buildDeployPayload());
      setSelectedJobId(job.id);
      toastService.success({
        title: formatMessage({ id: "app.deployment.ops.jobStarted" }),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" });
      trackAdminDeployFailed({
        chainId: selectedChainId,
        contractType: "green-goods-core",
        error: message,
      });
      toastService.error({
        title: formatMessage({ id: "app.deployment.ops.submitFailed" }),
        description: message,
      });
    }
  };

  useEffect(() => {
    if (!currentJob) return;
    if (currentJob.status !== "succeeded") return;
    if (currentJob.id === trackedSuccessJobId) return;

    if (currentJob.type === "finalize-deploy") {
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
    }
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-strong">
          {formatMessage({ id: "app.deployment.title" })}
        </h1>
        <p className="text-text-sub">
          {formatMessage({ id: "app.deployment.description" }, { chain: chain.name })}
        </p>
      </div>

      <Card padding="feature">
        <div className="flex items-center mb-4">
          <RiCodeBoxLine className="h-5 w-5 text-information-base mr-2" />
          <h2 className="text-lg font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.ops.runnerTitle" })}
          </h2>
        </div>

        <p className="text-sm text-text-sub mb-4">
          {formatMessage({ id: "app.deployment.ops.runnerDescription" })}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`text-sm font-medium ${
              opsHealth.data?.ok ? "text-success-base" : "text-error-base"
            }`}
          >
            {opsHealth.data?.ok
              ? formatMessage({ id: "app.deployment.ops.runnerOnline" })
              : formatMessage({ id: "app.deployment.ops.runnerOffline" })}
          </span>

          {!isAuthenticated ? (
            <Button
              type="button"
              onClick={handleConnectRunner}
              loading={opsAuth.requestChallenge.isPending || opsAuth.verifySignature.isPending}
            >
              {formatMessage({ id: "app.deployment.ops.authenticate" })}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={clearSession}>
              {formatMessage({ id: "app.deployment.ops.disconnect" })}
            </Button>
          )}

          {session?.address && (
            <span className="text-xs text-text-soft">
              {formatMessage(
                { id: "app.deployment.ops.connectedAs" },
                { address: formatAddress(session.address as Address) }
              )}
            </span>
          )}
        </div>
      </Card>

      {/* Permissions Status */}
      <Card padding="feature">
        <div className="flex items-center mb-4">
          <RiShieldCheckLine className="h-5 w-5 text-information-base mr-2" />
          <h2 className="text-lg font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.permissions" })}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                permissions.isOwner
                  ? "bg-success-lighter text-success-base"
                  : "bg-bg-weak text-text-disabled"
              }`}
            >
              <RiSettings3Line className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-text-strong">
              {formatMessage({ id: "app.deployment.role.owner" })}
            </p>
            <p
              className={`text-xs ${permissions.isOwner ? "text-success-base" : "text-text-soft"}`}
            >
              {permissions.isOwner
                ? formatMessage({ id: "app.deployment.enabled" })
                : formatMessage({ id: "app.deployment.notAuthorized" })}
            </p>
          </div>
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                permissions.isInAllowlist
                  ? "bg-information-lighter text-information-base"
                  : "bg-bg-weak text-text-disabled"
              }`}
            >
              <RiCodeBoxLine className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-text-strong">
              {formatMessage({ id: "app.deployment.role.allowlisted" })}
            </p>
            <p
              className={`text-xs ${permissions.isInAllowlist ? "text-information-base" : "text-text-soft"}`}
            >
              {permissions.isInAllowlist
                ? formatMessage({ id: "app.deployment.enabled" })
                : formatMessage({ id: "app.deployment.notAuthorized" })}
            </p>
          </div>
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                permissions.canDeploy
                  ? "bg-feature-lighter text-feature-dark"
                  : "bg-bg-weak text-text-disabled"
              }`}
            >
              <RiGitBranchLine className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-text-strong">
              {formatMessage({ id: "app.deployment.role.canDeploy" })}
            </p>
            <p
              className={`text-xs ${permissions.canDeploy ? "text-feature-dark" : "text-text-soft"}`}
            >
              {permissions.canDeploy
                ? formatMessage({ id: "app.deployment.authorized" })
                : formatMessage({ id: "app.deployment.notAuthorized" })}
            </p>
          </div>
        </div>
      </Card>

      {/* Minter Allowlist - owner only */}
      {permissions.isOwner && <AllowlistCard chainId={selectedChainId} />}

      {/* Deployment Actions */}
      <Card padding="feature">
        <div className="flex items-center mb-4">
          <RiUploadLine className="h-5 w-5 text-success-base mr-2" />
          <h2 className="text-lg font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.actions" })}
          </h2>
        </div>

        {permissions.canDeploy ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-strong mb-1" htmlFor="sender">
                  {formatMessage({ id: "app.deployment.ops.senderLabel" })}
                </label>
                <input
                  id="sender"
                  type="text"
                  value={sender}
                  onChange={(event) => setSender(event.target.value)}
                  className="w-full px-3 py-2 border border-stroke-sub bg-bg-white text-text-strong rounded-lg"
                  placeholder="0x..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-strong mb-1" htmlFor="salt">
                  {formatMessage({ id: "app.deployment.ops.saltLabel" })}
                </label>
                <input
                  id="salt"
                  type="text"
                  value={deploymentSalt}
                  onChange={(event) => setDeploymentSalt(event.target.value)}
                  className="w-full px-3 py-2 border border-stroke-sub bg-bg-white text-text-strong rounded-lg"
                  placeholder="greenGoodsCleanDeploy2025:14"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-text-sub">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={updateSchemasOnly}
                  onChange={(event) => setUpdateSchemasOnly(event.target.checked)}
                />
                {formatMessage({ id: "app.deployment.ops.updateSchemasOnly" })}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={forceRedeploy}
                  onChange={(event) => setForceRedeploy(event.target.checked)}
                />
                {formatMessage({ id: "app.deployment.ops.forceRedeploy" })}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={syncEnvio}
                  onChange={(event) => setSyncEnvio(event.target.checked)}
                />
                {formatMessage({ id: "app.deployment.ops.syncEnvio" })}
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={runDeployPlan}
                loading={deployPlanMutation.isPending}
                disabled={!isAuthenticated}
              >
                {formatMessage({ id: "app.deployment.ops.generatePlan" })}
              </Button>
              <Button
                type="button"
                onClick={runDeployFinalize}
                loading={finalizeDeployMutation.isPending}
                disabled={!isAuthenticated}
              >
                {formatMessage({ id: "app.deployment.ops.executeDeploy" })}
              </Button>
            </div>

            {!isAuthenticated && (
              <p className="text-sm text-error-base">
                {formatMessage({ id: "app.deployment.ops.authRequired" })}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <RiErrorWarningLine className="mx-auto h-12 w-12 text-text-disabled" />
            <h3 className="mt-2 text-sm font-medium text-text-strong">
              {formatMessage({ id: "app.deployment.notAvailable" })}
            </h3>
            <p className="mt-1 text-sm text-text-soft">
              {formatMessage({ id: "app.deployment.notAvailableDescription" })}
            </p>
          </div>
        )}
      </Card>

      <Card padding="feature">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.ops.statusTitle" })}
          </h2>
          <select
            value={selectedJobId ?? ""}
            onChange={(event) => setSelectedJobId(event.target.value || null)}
            className="border border-stroke-sub rounded-lg px-2 py-1 text-sm bg-bg-white"
          >
            <option value="">{formatMessage({ id: "app.deployment.ops.selectJob" })}</option>
            {recentJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.type} · {job.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>

        {!selectedJobId ? (
          <p className="text-sm text-text-soft">
            {formatMessage({ id: "app.deployment.ops.noJobs" })}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-text-sub">
              <span className="mr-2">{formatMessage({ id: "app.deployment.ops.jobLabel" })}:</span>
              <code>{selectedJobId}</code>
            </div>

            <div className="text-sm">
              <span className="text-text-sub mr-2">
                {formatMessage({ id: "app.deployment.statusLabel" })}:
              </span>
              <span
                className={getOpsStatusBadge(
                  currentJob?.status ?? jobLogs.status?.status ?? "queued"
                )}
              >
                {formatMessage({
                  id: `app.deployment.ops.status.${currentJob?.status ?? jobLogs.status?.status ?? "queued"}`,
                })}
              </span>
            </div>

            <div>
              <p className="text-sm font-medium text-text-strong mb-2">
                {formatMessage({ id: "app.deployment.ops.liveLogs" })}
              </p>
              <pre className="text-xs bg-bg-weak rounded-lg p-3 max-h-80 overflow-auto whitespace-pre-wrap">
                {jobLogs.logs
                  .map((entry) => `${entry.at} [${entry.stream}] ${entry.message}`)
                  .join("\n")}
              </pre>
              {jobLogs.error && <p className="text-xs text-error-base mt-2">{jobLogs.error}</p>}
            </div>

            {currentJob?.result && (
              <div>
                <p className="text-sm font-medium text-text-strong mb-2">
                  {formatMessage({ id: "app.deployment.ops.result" })}
                </p>
                <pre className="text-xs bg-bg-weak rounded-lg p-3 max-h-80 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(currentJob.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Documentation */}
      <Card padding="feature">
        <div className="flex items-center mb-4">
          <RiCodeBoxLine className="h-5 w-5 text-text-soft mr-2" />
          <h2 className="text-lg font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.manual.title" })}
          </h2>
        </div>
        <div className="bg-bg-weak rounded-lg p-4">
          <p className="text-sm text-text-sub mb-3">
            {formatMessage({ id: "app.deployment.manual.description" })}
          </p>
          <code className="text-sm bg-bg-soft px-2 py-1 rounded block">
            bun script/deploy.ts core --network {network} --broadcast
          </code>
        </div>
      </Card>
    </div>
  );
}

// --- Allowlist Management Card (owner-only) ---

function AllowlistCard({ chainId }: { chainId: number }) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const wagmiConfig = useConfig();
  const { allowlist, loading } = useDeploymentAllowlist(true);

  const [addressInput, setAddressInput] = useState("");
  const [error, setError] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [removingAddress, setRemovingAddress] = useState<string | null>(null);

  const contracts = getNetworkContracts(chainId);
  const registryAddress = contracts.deploymentRegistry as `0x${string}`;

  const trimmed = addressInput.trim();
  const isHexAddress = useMemo(() => (trimmed ? isAddress(trimmed) : false), [trimmed]);
  const shouldResolveEns = trimmed.length > 2 && !isHexAddress;
  const { data: resolvedEnsAddress, isFetching: resolvingEns } = useEnsAddress(
    shouldResolveEns ? trimmed : null,
    { enabled: shouldResolveEns }
  );

  const invalidateQueries = () => {
    for (const key of queryInvalidation.invalidateAllowlist(chainId)) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!trimmed) return;

    let addressToAdd: Address;
    if (isAddress(trimmed)) {
      addressToAdd = trimmed;
    } else if (resolvedEnsAddress && isAddress(resolvedEnsAddress)) {
      addressToAdd = resolvedEnsAddress;
    } else {
      setError(
        formatMessage({
          id: "app.admin.roles.error.ensResolutionFailed",
          defaultMessage: "Could not resolve ENS name",
        })
      );
      return;
    }

    setAddingAddress(true);
    try {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: DEPLOYMENT_REGISTRY_ABI,
        functionName: "addToAllowlist",
        args: [addressToAdd],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });

      toastService.success({
        title: formatMessage({ id: "app.deployment.allowlist.addSuccess" }),
      });
      setAddressInput("");
      invalidateQueries();
    } catch (err) {
      const parsed = parseContractError(err);
      const knownMessage =
        USER_FRIENDLY_ERRORS[parsed.name.toLowerCase()] ?? (parsed.isKnown ? parsed.message : null);
      const errorMsg = knownMessage ?? formatMessage({ id: "app.deployment.allowlist.addFailed" });
      setError(errorMsg);
      toastService.error({ title: errorMsg });
      logger.error("Failed to add to allowlist", { error: err, parsed });
    } finally {
      setAddingAddress(false);
    }
  };

  const handleRemove = async (address: Address) => {
    const confirmed = window.confirm(
      formatMessage(
        { id: "app.deployment.allowlist.confirmRemove" },
        { address: formatAddress(address) }
      )
    );
    if (!confirmed) return;

    setRemovingAddress(address);
    try {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: DEPLOYMENT_REGISTRY_ABI,
        functionName: "removeFromAllowlist",
        args: [address],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });

      toastService.success({
        title: formatMessage({ id: "app.deployment.allowlist.removeSuccess" }),
      });
      invalidateQueries();
    } catch (err) {
      const parsed = parseContractError(err);
      const knownMessage =
        USER_FRIENDLY_ERRORS[parsed.name.toLowerCase()] ?? (parsed.isKnown ? parsed.message : null);
      const errorMsg =
        knownMessage ?? formatMessage({ id: "app.deployment.allowlist.removeFailed" });
      toastService.error({ title: errorMsg });
      logger.error("Failed to remove from allowlist", { error: err, parsed });
    } finally {
      setRemovingAddress(null);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setAddressInput(text.trim());
        setError("");
      }
    } catch (err) {
      logger.error("Failed to read clipboard", { error: err });
    }
  };

  return (
    <Card padding="feature">
      <div className="flex items-center mb-4">
        <RiUserAddLine className="h-5 w-5 text-feature-dark mr-2" />
        <div>
          <h2 className="text-lg font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.allowlist.title" })}
          </h2>
          <p className="text-sm text-text-soft">
            {formatMessage({ id: "app.deployment.allowlist.description" })}
          </p>
        </div>
      </div>

      {/* Add address form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={addressInput}
            onChange={(e) => {
              setAddressInput(e.target.value);
              setError("");
            }}
            className="w-full px-3 py-2 pr-10 border border-stroke-sub bg-bg-white text-text-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-base focus:border-primary-base"
            placeholder={formatMessage({ id: "app.deployment.allowlist.placeholder" })}
            disabled={addingAddress}
            aria-label={formatMessage({ id: "app.deployment.allowlist.placeholder" })}
          />
          <button
            type="button"
            onClick={handlePaste}
            disabled={addingAddress}
            className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center text-text-soft hover:text-text-sub disabled:opacity-50"
            title={formatMessage({
              id: "admin.addMember.paste",
              defaultMessage: "Paste from clipboard",
            })}
          >
            <RiClipboardLine className="h-4 w-4" />
          </button>
        </div>
        <Button
          type="submit"
          disabled={addingAddress || !trimmed || (shouldResolveEns && resolvingEns)}
          loading={addingAddress}
        >
          {addingAddress
            ? formatMessage({ id: "app.deployment.allowlist.adding" })
            : formatMessage({ id: "app.deployment.allowlist.add" })}
        </Button>
      </form>

      {/* ENS resolution feedback */}
      {shouldResolveEns && (
        <p className="mb-2 text-xs text-text-soft">
          {resolvingEns
            ? formatMessage({
                id: "admin.addMember.resolvingEns",
                defaultMessage: "Resolving ENS name...",
              })
            : resolvedEnsAddress
              ? formatMessage(
                  {
                    id: "admin.addMember.ensResolved",
                    defaultMessage: "Resolves to {address}",
                  },
                  { address: formatAddress(resolvedEnsAddress) }
                )
              : formatMessage({
                  id: "admin.addMember.enterValidAddress",
                  defaultMessage: "Enter a valid ENS name or 0x address.",
                })}
        </p>
      )}

      {/* Error display */}
      {error && (
        <p role="alert" className="mb-3 text-sm text-error-dark">
          {error}
        </p>
      )}

      {/* Allowlist table */}
      {loading ? (
        <div className="py-6 text-center text-text-soft text-sm">Loading...</div>
      ) : allowlist.length === 0 ? (
        <div className="py-6 text-center text-text-soft text-sm">
          {formatMessage({ id: "app.deployment.allowlist.empty" })}
        </div>
      ) : (
        <div className="space-y-2">
          {allowlist.map((addr) => (
            <div key={addr} className="flex items-center justify-between p-3 bg-bg-weak rounded-lg">
              <code className="text-sm text-text-strong font-mono">{formatAddress(addr)}</code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(addr)}
                disabled={removingAddress === addr}
                loading={removingAddress === addr}
              >
                {removingAddress === addr ? (
                  formatMessage({ id: "app.deployment.allowlist.removing" })
                ) : (
                  <>
                    <RiDeleteBinLine className="h-4 w-4 mr-1" />
                    {formatMessage({ id: "app.deployment.allowlist.remove" })}
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
