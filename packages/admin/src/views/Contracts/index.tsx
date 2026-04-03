import {
  type Address,
  getNetworkContracts,
  isZeroAddress,
  SUPPORTED_CHAINS,
  useAdminStore,
} from "@green-goods/shared";
import * as Tabs from "@radix-ui/react-tabs";
import {
  RiExternalLinkLine,
  RiRefreshLine,
  RiSettings3Line,
  RiToolsLine,
  RiUploadLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AddressDisplay } from "@/components/AddressDisplay";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ContractUpgradePanel } from "./ContractUpgradePanel";

export default function Contracts() {
  const { formatMessage } = useIntl();
  const selectedChainId = useAdminStore((s) => s.selectedChainId);

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
            <ContractUpgradePanel
              selectedChainId={selectedChainId}
              chainName={currentChain?.name}
            />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
