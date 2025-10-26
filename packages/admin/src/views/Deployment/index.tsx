import { useDeploymentRegistry } from "@green-goods/shared/hooks";
import { useAdminStore } from "@green-goods/shared/stores";
import { getChain } from "@green-goods/shared/utils/contracts";
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

export default function Deployment() {
  const { selectedChainId } = useAdminStore();
  const permissions = useDeploymentRegistry();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<string>("");
  const chain = getChain(selectedChainId);

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentResult("");
    try {
      // Note: This would typically call the deployment script via API
      setDeploymentResult(
        "Deployment started... This would integrate with the contracts deployment script."
      );
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Mock deployment
      setDeploymentResult("✅ Deployment completed successfully!");
    } catch (error) {
      setDeploymentResult(
        `❌ Deployment failed: ${error instanceof Error ? error.message : "Unknown error"}`
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
          <h3 className="mt-2 text-sm font-medium text-text-strong">Access Denied</h3>
          <p className="mt-1 text-sm text-text-soft">
            You need to be the owner or in the deployment allowlist to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-strong">Contract Deployment</h1>
        <p className="text-text-sub">Deploy and manage Green Goods contracts on {chain.name}</p>
      </div>

      {/* Permissions Status */}
      <div className="bg-bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <RiShieldCheckLine className="h-5 w-5 text-information-base mr-2" />
          <h2 className="text-lg font-medium text-text-strong">Deployment Permissions</h2>
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
            <p className="text-sm font-medium text-text-strong">Owner</p>
            <p
              className={`text-xs ${permissions.isOwner ? "text-success-base" : "text-text-soft"}`}
            >
              {permissions.isOwner ? "Enabled" : "Not authorized"}
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
            <p className="text-sm font-medium text-text-strong">Allowlisted</p>
            <p
              className={`text-xs ${permissions.isInAllowlist ? "text-information-base" : "text-text-soft"}`}
            >
              {permissions.isInAllowlist ? "Enabled" : "Not authorized"}
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
            <p className="text-sm font-medium text-text-strong">Can Deploy</p>
            <p
              className={`text-xs ${permissions.canDeploy ? "text-purple-600" : "text-text-soft"}`}
            >
              {permissions.canDeploy ? "Authorized" : "Not authorized"}
            </p>
          </div>
        </div>
      </div>

      {/* Deployment Actions */}
      <div className="bg-bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <RiUploadLine className="h-5 w-5 text-success-base mr-2" />
          <h2 className="text-lg font-medium text-text-strong">Deployment Actions</h2>
        </div>

        {permissions.canDeploy ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-bg-weak rounded-lg">
              <div>
                <h3 className="font-medium text-text-strong">Deploy Green Goods Contracts</h3>
                <p className="text-sm text-text-sub">
                  Deploy the complete Green Goods protocol suite to {chain.name}
                </p>
              </div>
              <button
                onClick={handleDeploy}
                disabled={isDeploying}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {isDeploying ? (
                  <>
                    <RiLoaderLine className="animate-spin -ml-1 mr-3 h-4 w-4" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <RiUploadLine className="-ml-1 mr-2 h-4 w-4" />
                    Deploy Contracts
                  </>
                )}
              </button>
            </div>

            {deploymentResult && (
              <div className="mt-4 p-4 bg-bg-weak rounded-lg">
                <h4 className="text-sm font-medium text-text-strong mb-2">Deployment Status:</h4>
                <pre className="text-sm text-text-sub whitespace-pre-wrap">{deploymentResult}</pre>
              </div>
            )}

            <div className="mt-6 p-4 bg-information-lighter rounded-lg">
              <h4 className="text-sm font-medium text-information-dark mb-2">
                💡 Deployment Guide
              </h4>
              <p className="text-sm text-information-dark">
                This deployment will update the Garden Token contract to use the deployment registry
                allowlist for minting permissions, enabling broader access to garden creation beyond
                just the contract owner.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <RiErrorWarningLine className="mx-auto h-12 w-12 text-text-disabled" />
            <h3 className="mt-2 text-sm font-medium text-text-strong">Deployment Not Available</h3>
            <p className="mt-1 text-sm text-text-soft">
              You don&apos;t have permission to deploy contracts on this network.
            </p>
          </div>
        )}
      </div>

      {/* Documentation */}
      <div className="bg-bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <RiCodeBoxLine className="h-5 w-5 text-text-soft mr-2" />
          <h2 className="text-lg font-medium text-text-strong">Manual Deployment</h2>
        </div>
        <div className="bg-bg-weak rounded-lg p-4">
          <p className="text-sm text-text-sub mb-3">
            To deploy contracts manually using the command line:
          </p>
          <code className="text-sm bg-bg-soft px-2 py-1 rounded block">
            cd packages/contracts && node script/deploy.js core --network {chain.name.toLowerCase()}{" "}
            --broadcast --verify
          </code>
        </div>
      </div>
    </div>
  );
}
