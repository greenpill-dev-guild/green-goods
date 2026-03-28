import {
  type Address,
  formatAddress,
  toastService,
  trackAdminDeployFailed,
  trackAdminDeployStarted,
} from "@green-goods/shared";
import {
  RiCodeBoxLine,
  RiErrorWarningLine,
  RiGitBranchLine,
  RiPlayCircleLine,
  RiSettings3Line,
  RiShieldCheckLine,
  RiUploadLine,
} from "@remixicon/react";
import type { ReactNode } from "react";
import type { useIntl } from "react-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type FormatMessage = ReturnType<typeof useIntl>["formatMessage"];

interface DeploymentPermissions {
  isOwner: boolean;
  isInAllowlist: boolean;
  canDeploy: boolean;
}

interface OpsScript {
  id: string;
  description: string;
}

interface DeployPayload {
  network: string;
  sender?: string;
  updateSchemasOnly: boolean;
  force: boolean;
  deploymentSalt?: string;
  syncEnvio: boolean;
}

interface DeploymentRunnerPanelProps {
  formatMessage: FormatMessage;
  selectedChainId: number;
  network: string;
  permissions: DeploymentPermissions;
  walletAddress?: Address;
  signMessageAsync: ({ message }: { message: string }) => Promise<string>;
  isAuthenticated: boolean;
  sessionAddress?: Address | null;
  clearSession: () => void;
  runnerOnline: boolean;
  authLoading: boolean;
  requestChallenge: (address: Address) => Promise<{ message: string }>;
  verifySignature: (address: Address, signature: string) => Promise<unknown>;
  scripts: OpsScript[];
  scriptsLoading: boolean;
  runScriptPending: boolean;
  runScript: (scriptId: string) => Promise<{ id: string }>;
  sender: string;
  setSender: (value: string) => void;
  deploymentSalt: string;
  setDeploymentSalt: (value: string) => void;
  updateSchemasOnly: boolean;
  setUpdateSchemasOnly: (value: boolean) => void;
  forceRedeploy: boolean;
  setForceRedeploy: (value: boolean) => void;
  syncEnvio: boolean;
  setSyncEnvio: (value: boolean) => void;
  deployPlanPending: boolean;
  runDeployPlan: (payload: DeployPayload) => Promise<{ id: string }>;
  finalizeDeployPending: boolean;
  runDeployFinalize: (payload: DeployPayload) => Promise<{ id: string }>;
  setSelectedJobId: (jobId: string | null) => void;
  allowlistManager?: ReactNode;
  jobMonitor?: ReactNode;
  isOpenMinting?: boolean;
  openMintingLoading: boolean;
  setOpenMintingPending: boolean;
  setOpenMinting: (isOpen: boolean) => void;
}

export function DeploymentRunnerPanel({
  formatMessage,
  selectedChainId,
  network,
  permissions,
  walletAddress,
  signMessageAsync,
  isAuthenticated,
  sessionAddress,
  clearSession,
  runnerOnline,
  authLoading,
  requestChallenge,
  verifySignature,
  scripts,
  scriptsLoading,
  runScriptPending,
  runScript,
  sender,
  setSender,
  deploymentSalt,
  setDeploymentSalt,
  updateSchemasOnly,
  setUpdateSchemasOnly,
  forceRedeploy,
  setForceRedeploy,
  syncEnvio,
  setSyncEnvio,
  deployPlanPending,
  runDeployPlan,
  finalizeDeployPending,
  runDeployFinalize,
  setSelectedJobId,
  allowlistManager,
  jobMonitor,
  isOpenMinting,
  openMintingLoading,
  setOpenMintingPending,
  setOpenMinting,
}: DeploymentRunnerPanelProps) {
  const handleConnectRunner = async () => {
    if (!walletAddress) {
      toastService.error({
        title: formatMessage({ id: "app.deployment.ops.connectWalletFirst" }),
      });
      return;
    }

    try {
      const challenge = await requestChallenge(walletAddress);
      const signature = await signMessageAsync({ message: challenge.message });
      await verifySignature(walletAddress, signature);
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

  const runScriptAndTrack = async (scriptId: string) => {
    if (!isAuthenticated) {
      toastService.error({ title: formatMessage({ id: "app.ops.authRequired" }) });
      return;
    }

    try {
      const job = await runScript(scriptId);
      setSelectedJobId(job.id);
      toastService.success({ title: formatMessage({ id: "app.ops.jobStarted" }) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" });
      toastService.error({
        title: formatMessage({ id: "app.ops.runFailed" }),
        description: message,
      });
    }
  };

  const buildDeployPayload = (): DeployPayload => ({
    network,
    sender: sender.trim() || undefined,
    updateSchemasOnly,
    force: forceRedeploy,
    deploymentSalt: deploymentSalt.trim() || undefined,
    syncEnvio,
  });

  const runPlan = async () => {
    if (!isAuthenticated) {
      toastService.error({ title: formatMessage({ id: "app.deployment.ops.authRequired" }) });
      return;
    }

    trackAdminDeployStarted({
      chainId: selectedChainId,
      contractType: "green-goods-core",
    });

    try {
      const job = await runDeployPlan(buildDeployPayload());
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

  const runFinalize = async () => {
    if (!isAuthenticated) {
      toastService.error({ title: formatMessage({ id: "app.deployment.ops.authRequired" }) });
      return;
    }

    trackAdminDeployStarted({
      chainId: selectedChainId,
      contractType: "green-goods-core",
    });

    try {
      const job = await runDeployFinalize(buildDeployPayload());
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

  return (
    <>
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
            className={`text-sm font-medium ${runnerOnline ? "text-success-base" : "text-error-base"}`}
          >
            {runnerOnline
              ? formatMessage({ id: "app.deployment.ops.runnerOnline" })
              : formatMessage({ id: "app.deployment.ops.runnerOffline" })}
          </span>

          {!isAuthenticated ? (
            <Button type="button" onClick={handleConnectRunner} loading={authLoading}>
              {formatMessage({ id: "app.deployment.ops.authenticate" })}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={clearSession}>
              {formatMessage({ id: "app.deployment.ops.disconnect" })}
            </Button>
          )}

          {sessionAddress && (
            <span className="text-xs text-text-soft">
              {formatMessage(
                { id: "app.deployment.ops.connectedAs" },
                { address: formatAddress(sessionAddress) }
              )}
            </span>
          )}
        </div>
      </Card>

      <Card padding="feature">
        <div className="flex items-center mb-4">
          <RiPlayCircleLine className="h-5 w-5 text-feature-dark mr-2" />
          <h2 className="text-lg font-medium text-text-strong">
            {formatMessage({ id: "app.ops.scriptsTitle" })}
          </h2>
        </div>

        {!isAuthenticated ? (
          <p className="text-sm text-error-base">{formatMessage({ id: "app.ops.authRequired" })}</p>
        ) : scriptsLoading ? (
          <p className="text-sm text-text-soft">
            {formatMessage({ id: "app.ops.loadingScripts" })}
          </p>
        ) : (
          <div className="space-y-3">
            {scripts.map((script) => (
              <div
                key={script.id}
                className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded-lg border border-stroke-soft p-3"
              >
                <div>
                  <p className="text-sm font-medium text-text-strong">{script.id}</p>
                  <p className="text-xs text-text-soft">{script.description}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => runScriptAndTrack(script.id)}
                  loading={runScriptPending}
                >
                  {formatMessage({ id: "app.ops.runScript" })}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

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

      {permissions.isOwner && allowlistManager}

      {permissions.isOwner && (
        <Card padding="feature">
          <div className="flex items-center mb-4">
            <RiShieldCheckLine className="h-5 w-5 text-primary-base mr-2" />
            <h2 className="text-lg font-medium text-text-strong">
              {formatMessage({
                id: "app.deployment.openMinting.title",
                defaultMessage: "Garden Minting Access",
              })}
            </h2>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-text-strong">
                {formatMessage({
                  id: "app.deployment.openMinting.label",
                  defaultMessage: "Open minting",
                })}
              </p>
              <p className="text-xs text-text-sub">
                {isOpenMinting
                  ? formatMessage({
                      id: "app.deployment.openMinting.openDescription",
                      defaultMessage: "Anyone can create a garden",
                    })
                  : formatMessage({
                      id: "app.deployment.openMinting.restrictedDescription",
                      defaultMessage: "Only allowlisted addresses and the owner can create gardens",
                    })}
              </p>
            </div>
            <button
              type="button"
              disabled={openMintingLoading || setOpenMintingPending}
              onClick={() => setOpenMinting(!isOpenMinting)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-base focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                isOpenMinting ? "bg-primary-base" : "bg-bg-strong"
              }`}
              role="switch"
              aria-checked={!!isOpenMinting}
              aria-label={formatMessage({
                id: "app.deployment.openMinting.toggle",
                defaultMessage: "Toggle open minting",
              })}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isOpenMinting ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </Card>
      )}

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
                onClick={runPlan}
                loading={deployPlanPending}
                disabled={!isAuthenticated}
              >
                {formatMessage({ id: "app.deployment.ops.generatePlan" })}
              </Button>
              <Button
                type="button"
                onClick={runFinalize}
                loading={finalizeDeployPending}
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

      {jobMonitor}

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
    </>
  );
}
