import {
  SUPPORTED_CHAINS,
  formatAddress,
  useAdminStore,
  getNetworkContracts,
  type Address,
} from "@green-goods/shared";
import * as Tabs from "@radix-ui/react-tabs";
import { RiRefreshLine, RiSettings3Line, RiUploadLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Card } from "@/components/ui/Card";

export default function Contracts() {
  const { formatMessage } = useIntl();
  const selectedChainId = useAdminStore((s) => s.selectedChainId);

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

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-text-strong">
          {formatMessage({ id: "app.contracts.title" })}
        </h1>
        <p className="text-text-sub mt-1">
          {formatMessage({ id: "app.contracts.description" }, { chain: currentChain?.name })}
        </p>
      </div>

      <Tabs.Root defaultValue="deployed">
        <Tabs.List className="border-b border-stroke-soft mb-8 -mb-px flex space-x-8">
          <Tabs.Trigger
            value="deployed"
            className="flex items-center py-3 px-1 border-b-2 border-transparent font-medium text-sm text-text-soft hover:text-text-sub hover:border-stroke-sub transition-colors data-[state=active]:border-primary-base data-[state=active]:text-primary-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
          >
            <RiSettings3Line className="mr-2 h-4 w-4" />
            {formatMessage({ id: "app.contracts.tabs.deployed" })}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="deploy"
            className="flex items-center py-3 px-1 border-b-2 border-transparent font-medium text-sm text-text-soft hover:text-text-sub hover:border-stroke-sub transition-colors data-[state=active]:border-primary-base data-[state=active]:text-primary-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
          >
            <RiUploadLine className="mr-2 h-4 w-4" />
            {formatMessage({ id: "app.contracts.tabs.deployNew" })}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="upgrade"
            className="flex items-center py-3 px-1 border-b-2 border-transparent font-medium text-sm text-text-soft hover:text-text-sub hover:border-stroke-sub transition-colors data-[state=active]:border-primary-base data-[state=active]:text-primary-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
          >
            <RiRefreshLine className="mr-2 h-4 w-4" />
            {formatMessage({ id: "app.contracts.tabs.upgrade" })}
          </Tabs.Trigger>
        </Tabs.List>

        {/* Deployed Contracts */}
        <Tabs.Content value="deployed">
          <Card>
            <Card.Header className="flex-col items-start">
              <h2 className="text-lg font-medium text-text-strong">
                {formatMessage({ id: "app.contracts.tabs.deployed" })}
              </h2>
              <p className="text-sm text-text-sub mt-1">
                {formatMessage(
                  { id: "app.contracts.deployed.description" },
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

            {/* Mobile card list */}
            <div className="space-y-3 p-4 sm:hidden">
              {contractList.map((contract) => (
                <div
                  key={contract.name}
                  className="rounded-lg border border-stroke-soft bg-bg-weak p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-text-strong">{contract.name}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(contract.address)}`}
                    >
                      {getStatusText(contract.address)}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-soft">
                        {formatMessage({ id: "app.contracts.table.type" })}
                      </span>
                      <span className="font-medium text-text-strong capitalize">
                        {contract.type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-soft">
                        {formatMessage({ id: "app.contracts.table.address" })}
                      </span>
                      <span className="font-mono text-text-strong">
                        {formatAddress(contract.address, { variant: "card" })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Tabs.Content>

        {/* Deploy New */}
        <Tabs.Content value="deploy">
          <Card>
            <Card.Header className="flex-col items-start">
              <h2 className="text-lg font-medium text-text-strong">
                {formatMessage({ id: "app.contracts.deploy.title" })}
              </h2>
              <p className="text-sm text-text-sub mt-1">
                {formatMessage(
                  { id: "app.contracts.deploy.description" },
                  { chain: currentChain?.name }
                )}
              </p>
            </Card.Header>
            <Card.Body>
              <div className="text-center py-12">
                <RiUploadLine className="mx-auto h-12 w-12 text-text-soft" />
                <h3 className="mt-2 text-sm font-medium text-text-strong">
                  {formatMessage({ id: "app.contracts.deploy.title" })}
                </h3>
                <p className="mt-1 text-sm text-text-soft">
                  {formatMessage({ id: "app.contracts.deploy.comingSoon" })}
                </p>
              </div>
            </Card.Body>
          </Card>
        </Tabs.Content>

        {/* Upgrade */}
        <Tabs.Content value="upgrade">
          <Card>
            <Card.Header className="flex-col items-start">
              <h2 className="text-lg font-medium text-text-strong">
                {formatMessage({ id: "app.contracts.upgrade.title" })}
              </h2>
              <p className="text-sm text-text-sub mt-1">
                {formatMessage(
                  { id: "app.contracts.upgrade.description" },
                  { chain: currentChain?.name }
                )}
              </p>
            </Card.Header>
            <Card.Body>
              <div className="text-center py-12">
                <RiRefreshLine className="mx-auto h-12 w-12 text-text-soft" />
                <h3 className="mt-2 text-sm font-medium text-text-strong">
                  {formatMessage({ id: "app.contracts.upgrade.title" })}
                </h3>
                <p className="mt-1 text-sm text-text-soft">
                  {formatMessage({ id: "app.contracts.upgrade.comingSoon" })}
                </p>
              </div>
            </Card.Body>
          </Card>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
