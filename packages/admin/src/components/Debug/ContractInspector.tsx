import { useState, useMemo, useEffect } from "react";
import { RiBugLine, RiCloseLine, RiFileCopyLine } from "@remixicon/react";

import { SUPPORTED_CHAINS, getEASConfig } from "@/config";
import { useAdminStore } from "@/stores/admin";
import { getNetworkContracts, getChainById } from "@/utils/contracts";

function formatAddress(address: string) {
  if (!address) {
    return "—";
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Silently fail to avoid noisy logging in demo environments
  }
}

export function ContractInspector() {
  const selectedChainId = useAdminStore((state) => state.selectedChainId);
  const [isOpen, setIsOpen] = useState(false);
  const [activeChainId, setActiveChainId] = useState(selectedChainId);

  useEffect(() => {
    setActiveChainId(selectedChainId);
  }, [selectedChainId]);

  const chain = useMemo(() => getChainById(activeChainId), [activeChainId]);
  const contracts = useMemo(() => getNetworkContracts(activeChainId), [activeChainId]);
  const easConfig = useMemo(() => getEASConfig(activeChainId), [activeChainId]);

  const contractEntries = useMemo(
    () => [
      { label: "Garden Token", value: contracts.gardenToken },
      { label: "Deployment Registry", value: contracts.deploymentRegistry },
      { label: "Action Registry", value: contracts.actionRegistry },
      { label: "Work Resolver", value: contracts.workResolver },
      { label: "Work Approval Resolver", value: contracts.workApprovalResolver },
      { label: "Community Token", value: contracts.communityToken },
      { label: "Multicall Forwarder", value: contracts.multicallForwarder },
      { label: "EAS Core", value: easConfig.EAS.address },
      { label: "EAS Schema Registry", value: easConfig.SCHEMA_REGISTRY.address },
      { label: "Garden Assessment UID", value: easConfig.GARDEN_ASSESSMENT.uid },
    ],
    [contracts, easConfig]
  );

  return (
    <div className="fixed bottom-6 right-6 z-40 text-left">
      {isOpen && (
        <div className="mb-3 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Contract addresses
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {chain.name} • Chain ID {activeChainId}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              aria-label="Close inspector"
            >
              <RiCloseLine className="h-4 w-4" />
            </button>
          </div>

          <label className="mb-3 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Preview as chain
            <select
              value={activeChainId}
              onChange={(event) => setActiveChainId(Number(event.target.value))}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              {SUPPORTED_CHAINS.map((supportedChain) => (
                <option key={supportedChain.id} value={supportedChain.id}>
                  {supportedChain.name}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "16rem" }}>
            {contractEntries.map((entry) => (
              <div
                key={entry.label}
                className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="w-32 text-gray-600 dark:text-gray-300">{entry.label}</div>
                <div className="flex items-center space-x-2">
                  <code className="font-mono text-gray-800 dark:text-gray-100">
                    {formatAddress(entry.value)}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(entry.value)}
                    className="rounded-md p-1 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                    aria-label={`Copy ${entry.label}`}
                  >
                    <RiFileCopyLine className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex items-center space-x-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
      >
        <RiBugLine className="h-4 w-4" />
        <span>{isOpen ? "Hide addresses" : "Show contract map"}</span>
      </button>
    </div>
  );
}
