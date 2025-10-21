import { SUPPORTED_CHAINS } from "@green-goods/shared/config/chains";
import { useAdminStore } from "@green-goods/shared/stores";
import { getNetworkContracts } from "@green-goods/shared/utils/contracts";
import { RiRefreshLine, RiSettings3Line, RiUploadLine } from "@remixicon/react";
import { useState } from "react";

export default function Contracts() {
  const { selectedChainId } = useAdminStore();
  const [activeTab, setActiveTab] = useState<"deployed" | "deploy" | "upgrade">("deployed");

  const contracts = getNetworkContracts(selectedChainId);
  const chains = Object.values(SUPPORTED_CHAINS);
  const currentChain = chains.find((c) => c.id === selectedChainId);

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

  const getStatusColor = (address: string) => {
    if (address === "0x0000000000000000000000000000000000000000") {
      return "bg-red-100 text-red-800";
    }
    return "bg-green-100 text-green-800";
  };

  const getStatusText = (address: string) => {
    if (address === "0x0000000000000000000000000000000000000000") {
      return "Not Deployed";
    }
    return "Deployed";
  };

  const tabs = [
    { id: "deployed", name: "Deployed Contracts", icon: RiSettings3Line },
    { id: "deploy", name: "Deploy New", icon: RiUploadLine },
    { id: "upgrade", name: "Upgrade", icon: RiRefreshLine },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Contract Management</h1>
        <p className="text-gray-600 mt-1">
          Deploy and manage smart contracts on {currentChain?.name}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "deployed" | "deploy" | "upgrade")}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <tab.icon className="mr-2 h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "deployed" && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Deployed Contracts</h2>
            <p className="text-sm text-gray-600 mt-1">
              Current contract deployments on {currentChain?.name}
            </p>
          </div>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contract
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contractList.map((contract) => (
                  <tr key={contract.name}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {contract.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {contract.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {contract.address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(contract.address)}`}
                      >
                        {getStatusText(contract.address)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "deploy" && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Deploy New Contract</h2>
            <p className="text-sm text-gray-600 mt-1">
              Deploy new contracts to {currentChain?.name}
            </p>
          </div>
          <div className="p-6">
            <div className="text-center py-12">
              <RiUploadLine className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Contract Deployment</h3>
              <p className="mt-1 text-sm text-gray-500">
                Contract deployment functionality coming soon.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "upgrade" && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Upgrade Contracts</h2>
            <p className="text-sm text-gray-600 mt-1">
              Upgrade existing contracts on {currentChain?.name}
            </p>
          </div>
          <div className="p-6">
            <div className="text-center py-12">
              <RiRefreshLine className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Contract Upgrades</h3>
              <p className="mt-1 text-sm text-gray-500">
                Contract upgrade functionality coming soon.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
