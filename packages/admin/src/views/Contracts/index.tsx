import { SUPPORTED_CHAINS, useAdminStore, getNetworkContracts, type Address } from "@green-goods/shared";
import { RiRefreshLine, RiSettings3Line, RiUploadLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

export default function Contracts() {
  const { formatMessage } = useIntl();
  const selectedChainId = useAdminStore((s) => s.selectedChainId);
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

  const getStatusColor = (address: Address) => {
    if (address === "0x0000000000000000000000000000000000000000") {
      return "bg-error-lighter text-error-dark";
    }
    return "bg-success-lighter text-success-dark";
  };

  const getStatusText = (address: Address) => {
    if (address === "0x0000000000000000000000000000000000000000") {
      return formatMessage({ id: "app.contracts.status.notDeployed" });
    }
    return formatMessage({ id: "app.contracts.status.deployed" });
  };

  const tabs = [
    {
      id: "deployed",
      name: formatMessage({ id: "app.contracts.tabs.deployed" }),
      icon: RiSettings3Line,
    },
    {
      id: "deploy",
      name: formatMessage({ id: "app.contracts.tabs.deployNew" }),
      icon: RiUploadLine,
    },
    {
      id: "upgrade",
      name: formatMessage({ id: "app.contracts.tabs.upgrade" }),
      icon: RiRefreshLine,
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-strong">
          {formatMessage({ id: "app.contracts.title" })}
        </h1>
        <p className="text-text-sub mt-1">
          {formatMessage({ id: "app.contracts.description" }, { chain: currentChain?.name })}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-stroke-soft mb-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as "deployed" | "deploy" | "upgrade")}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-text-soft hover:text-text-sub hover:border-stroke-sub"
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
        <div className="bg-bg-white rounded-lg shadow-sm border border-stroke-soft">
          <div className="p-6 border-b border-stroke-soft">
            <h2 className="text-lg font-medium text-text-strong">
              {formatMessage({ id: "app.contracts.tabs.deployed" })}
            </h2>
            <p className="text-sm text-text-sub mt-1">
              {formatMessage(
                { id: "app.contracts.deployed.description" },
                { chain: currentChain?.name }
              )}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stroke-soft">
              <thead className="bg-bg-weak">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-text-soft uppercase tracking-wider"
                  >
                    {formatMessage({ id: "app.contracts.table.contract" })}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-text-soft uppercase tracking-wider"
                  >
                    {formatMessage({ id: "app.contracts.table.type" })}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-text-soft uppercase tracking-wider"
                  >
                    {formatMessage({ id: "app.contracts.table.address" })}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-text-soft uppercase tracking-wider"
                  >
                    {formatMessage({ id: "app.contracts.table.status" })}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-text-strong">
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
        <div className="bg-bg-white rounded-lg shadow-sm border border-stroke-soft">
          <div className="p-6 border-b border-stroke-soft">
            <h2 className="text-lg font-medium text-text-strong">
              {formatMessage({ id: "app.contracts.deploy.title" })}
            </h2>
            <p className="text-sm text-text-sub mt-1">
              {formatMessage(
                { id: "app.contracts.deploy.description" },
                { chain: currentChain?.name }
              )}
            </p>
          </div>
          <div className="p-6">
            <div className="text-center py-12">
              <RiUploadLine className="mx-auto h-12 w-12 text-text-soft" />
              <h3 className="mt-2 text-sm font-medium text-text-strong">
                {formatMessage({ id: "app.contracts.deploy.title" })}
              </h3>
              <p className="mt-1 text-sm text-text-soft">
                {formatMessage({ id: "app.contracts.deploy.comingSoon" })}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "upgrade" && (
        <div className="bg-bg-white rounded-lg shadow-sm border border-stroke-soft">
          <div className="p-6 border-b border-stroke-soft">
            <h2 className="text-lg font-medium text-text-strong">
              {formatMessage({ id: "app.contracts.upgrade.title" })}
            </h2>
            <p className="text-sm text-text-sub mt-1">
              {formatMessage(
                { id: "app.contracts.upgrade.description" },
                { chain: currentChain?.name }
              )}
            </p>
          </div>
          <div className="p-6">
            <div className="text-center py-12">
              <RiRefreshLine className="mx-auto h-12 w-12 text-text-soft" />
              <h3 className="mt-2 text-sm font-medium text-text-strong">
                {formatMessage({ id: "app.contracts.upgrade.title" })}
              </h3>
              <p className="mt-1 text-sm text-text-soft">
                {formatMessage({ id: "app.contracts.upgrade.comingSoon" })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
