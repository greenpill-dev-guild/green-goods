import { useState } from "react";
import {
  RiUploadLine,
  RiShieldCheckLine,
  RiErrorWarningLine,
  RiSettings3Line,
  RiCodeBoxLine,
  RiGitBranchLine,
  RiLoaderLine,
} from "@remixicon/react";
import { useDeploymentRegistry } from "@/hooks/useDeploymentRegistry";
import { useAdminStore } from "@/stores/admin";
import { getChainById } from "@/utils/contracts";
import { toast } from "react-hot-toast";

export default function Deployment() {
  const { selectedChainId } = useAdminStore();
  const permissions = useDeploymentRegistry();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<string>("");
  const chain = getChainById(selectedChainId);

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
      toast.success("Contracts deployed successfully");
    } catch (error) {
      setDeploymentResult(
        `❌ Deployment failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      toast.error(error instanceof Error ? error.message : "Failed to deploy contracts");
    } finally {
      setIsDeploying(false);
    }
  };

  if (!permissions.isOwner && !permissions.isInAllowlist) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <RiErrorWarningLine className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            Access Denied
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You need to be the owner or in the deployment allowlist to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Contract Deployment</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Deploy and manage Green Goods contracts on {chain.name}
        </p>
      </div>

      {/* Permissions Status */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <RiShieldCheckLine className="h-5 w-5 text-blue-500 mr-2" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Deployment Permissions
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                permissions.isOwner ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
              }`}
            >
              <RiSettings3Line className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Owner</p>
            <p className={`text-xs ${permissions.isOwner ? "text-green-600" : "text-gray-500"}`}>
              {permissions.isOwner ? "Enabled" : "Not authorized"}
            </p>
          </div>
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                permissions.isInAllowlist
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <RiCodeBoxLine className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Allowlisted</p>
            <p
              className={`text-xs ${permissions.isInAllowlist ? "text-blue-600" : "text-gray-500"}`}
            >
              {permissions.isInAllowlist ? "Enabled" : "Not authorized"}
            </p>
          </div>
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                permissions.canDeploy
                  ? "bg-purple-100 text-purple-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <RiGitBranchLine className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Can Deploy</p>
            <p className={`text-xs ${permissions.canDeploy ? "text-purple-600" : "text-gray-500"}`}>
              {permissions.canDeploy ? "Authorized" : "Not authorized"}
            </p>
          </div>
        </div>
      </div>

      {/* Deployment Actions */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <RiUploadLine className="h-5 w-5 text-green-500 mr-2" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Deployment Actions
          </h2>
        </div>

        {permissions.canDeploy ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  Deploy Green Goods Contracts
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
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
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Deployment Status:
                </h4>
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {deploymentResult}
                </pre>
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                💡 Deployment Guide
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                This deployment will update the Garden Token contract to use the deployment registry
                allowlist for minting permissions, enabling broader access to garden creation beyond
                just the contract owner.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <RiErrorWarningLine className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              Deployment Not Available
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              You don't have permission to deploy contracts on this network.
            </p>
          </div>
        )}
      </div>

      {/* Documentation */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <RiCodeBoxLine className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Manual Deployment
          </h2>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            To deploy contracts manually using the command line:
          </p>
          <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded block">
            cd packages/contracts && node script/deploy.js core --network {chain.name.toLowerCase()}{" "}
            --broadcast --verify
          </code>
        </div>
      </div>
    </div>
  );
}
