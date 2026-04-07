import {
  type Address,
  formatAddress,
  toastService,
  trackAdminDeployFailed,
  trackAdminDeployStarted,
} from "@green-goods/shared";
import { RiCodeBoxLine, RiErrorWarningLine, RiUploadLine } from "@remixicon/react";
import type { ReactNode } from "react";
import type { useIntl } from "react-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DeploymentMintingCard } from "./DeploymentMintingCard";
import { DeploymentPermissionsCard, type DeploymentPermissions } from "./DeploymentPermissionsCard";
import { DeploymentScriptsCard, type OpsScript } from "./DeploymentScriptsCard";

type FormatMessage = ReturnType<typeof useIntl>["formatMessage"];

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
  isAuthenticated: boolean;
  sessionAddress?: Address | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  runnerOnline: boolean;
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
  isAuthenticated,
  sessionAddress,
  connect,
  disconnect,
  isConnecting,
  runnerOnline,
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
            <Button type="button" onClick={connect} loading={isConnecting}>
              {formatMessage({ id: "app.deployment.ops.authenticate" })}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={disconnect}>
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

      <DeploymentScriptsCard
        formatMessage={formatMessage}
        isAuthenticated={isAuthenticated}
        scriptsLoading={scriptsLoading}
        scripts={scripts}
        runScriptPending={runScriptPending}
        runScriptAndTrack={runScriptAndTrack}
      />

      <DeploymentPermissionsCard formatMessage={formatMessage} permissions={permissions} />

      {permissions.isOwner && allowlistManager}

      {permissions.isOwner && (
        <DeploymentMintingCard
          formatMessage={formatMessage}
          isOpenMinting={isOpenMinting}
          openMintingLoading={openMintingLoading}
          setOpenMintingPending={setOpenMintingPending}
          setOpenMinting={setOpenMinting}
        />
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
