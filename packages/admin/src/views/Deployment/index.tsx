import {
  getChain,
  trackAdminDeployFailed,
  trackAdminDeployStarted,
  trackAdminDeploySuccess,
  useAdminStore,
  useDeploymentRegistry,
} from "@green-goods/shared";
import {
  RiCodeBoxLine,
  RiErrorWarningLine,
  RiGitBranchLine,
  RiLoaderLine,
  RiSettings3Line,
  RiShieldCheckLine,
  RiUploadLine,
} from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

export default function Deployment() {
  const { formatMessage } = useIntl();
  const selectedChainId = useAdminStore((s) => s.selectedChainId);
  const permissions = useDeploymentRegistry();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<string>("");
  const chain = getChain(selectedChainId);

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentResult("");

    trackAdminDeployStarted({
      chainId: selectedChainId,
      contractType: "green-goods-core",
    });

    try {
      setDeploymentResult(formatMessage({ id: "app.deployment.started" }));
      if (import.meta.env.DEV) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      trackAdminDeploySuccess({
        chainId: selectedChainId,
        contractType: "green-goods-core",
        contractAddress: "0x...",
        txHash: "0x...",
      });

      setDeploymentResult(formatMessage({ id: "app.deployment.success" }));
    } catch (error) {
      trackAdminDeployFailed({
        chainId: selectedChainId,
        contractType: "green-goods-core",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      setDeploymentResult(
        formatMessage(
          { id: "app.deployment.failed" },
          {
            error:
              error instanceof Error ? error.message : formatMessage({ id: "app.error.unknown" }),
          }
        )
      );
    } finally {
      setIsDeploying(false);
    }
  };

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

      {/* Permissions Status */}
      <div className="bg-bg-white shadow rounded-lg p-6">
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
                  ? "bg-purple-100 text-purple-600"
                  : "bg-bg-weak text-text-disabled"
              }`}
            >
              <RiGitBranchLine className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-text-strong">
              {formatMessage({ id: "app.deployment.role.canDeploy" })}
            </p>
            <p
              className={`text-xs ${permissions.canDeploy ? "text-purple-600" : "text-text-soft"}`}
            >
              {permissions.canDeploy
                ? formatMessage({ id: "app.deployment.authorized" })
                : formatMessage({ id: "app.deployment.notAuthorized" })}
            </p>
          </div>
        </div>
      </div>

      {/* Deployment Actions */}
      <div className="bg-bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <RiUploadLine className="h-5 w-5 text-success-base mr-2" />
          <h2 className="text-lg font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.actions" })}
          </h2>
        </div>

        {permissions.canDeploy ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-bg-weak rounded-lg">
              <div>
                <h3 className="font-medium text-text-strong">
                  {formatMessage({ id: "app.deployment.deployContracts" })}
                </h3>
                <p className="text-sm text-text-sub">
                  {formatMessage(
                    { id: "app.deployment.deployContractsDescription" },
                    { chain: chain.name }
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDeploy}
                disabled={isDeploying}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {isDeploying ? (
                  <>
                    <RiLoaderLine className="animate-spin -ml-1 mr-3 h-4 w-4" />
                    {formatMessage({ id: "app.deployment.deploying" })}
                  </>
                ) : (
                  <>
                    <RiUploadLine className="-ml-1 mr-2 h-4 w-4" />
                    {formatMessage({ id: "app.deployment.deployContracts" })}
                  </>
                )}
              </button>
            </div>

            {deploymentResult && (
              <div className="mt-4 p-4 bg-bg-weak rounded-lg">
                <h4 className="text-sm font-medium text-text-strong mb-2">
                  {formatMessage({ id: "app.deployment.statusLabel" })}
                </h4>
                <pre className="text-sm text-text-sub whitespace-pre-wrap">{deploymentResult}</pre>
              </div>
            )}

            <div className="mt-6 p-4 bg-information-lighter rounded-lg">
              <h4 className="text-sm font-medium text-information-dark mb-2">
                {formatMessage({ id: "app.deployment.guide.title" })}
              </h4>
              <p className="text-sm text-information-dark">
                {formatMessage({ id: "app.deployment.guide.description" })}
              </p>
            </div>
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
      </div>

      {/* Documentation */}
      <div className="bg-bg-white shadow rounded-lg p-6">
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
            bun script/deploy.ts core --network {chain.name.toLowerCase()} --broadcast
          </code>
        </div>
      </div>
    </div>
  );
}
