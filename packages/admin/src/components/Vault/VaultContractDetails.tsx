import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import type { Address } from "@green-goods/shared/types/domain";
import { isZeroAddress } from "@green-goods/shared/utils/blockchain/address";
import { getNetworkContracts } from "@green-goods/shared/utils/blockchain/contracts";
import { AAVE_V3_POOL, getVaultAssetSymbol } from "@green-goods/shared/utils/blockchain/vaults";
import { getBlockExplorerAddressUrl } from "@green-goods/shared/utils/eas/explorers";
import { RiExternalLinkLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { EnsAddressText } from "@/components/EnsAddressText";
import { AdminCard, AdminCardBody, AdminCardHeader } from "../AdminCard";

interface VaultContractDetailsProps {
  gardenAddress: Address;
}

/**
 * Expanded contract-address reference for a garden's endowment vaults. Lives in the endowment
 * right rail (and inline in the standalone `layout="page"` view). Replaces the former collapsed
 * `<details>` in GardenVaultView — the steward asked for these addresses always visible, not
 * tucked behind a disclosure. Rows stack (label over address) so they never wrap in the narrow
 * rail. Self-fetches via `useGardenVaults`; React Query dedupes with the main view's read.
 */
export function VaultContractDetails({ gardenAddress }: VaultContractDetailsProps) {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const octantModuleAddress = getNetworkContracts(chainId).octantModule as Address | undefined;
  const { vaults } = useGardenVaults(gardenAddress, { enabled: Boolean(gardenAddress) });

  if (vaults.length === 0) return null;

  const rowClass = "rounded-md border border-stroke-soft bg-bg-weak px-3 py-2";
  const linkClass =
    "mt-0.5 inline-flex items-center gap-1 body-xs text-primary-base hover:underline";

  return (
    <AdminCard density="none">
      <AdminCardHeader>
        <h3 className="label-md text-text-strong">
          {formatMessage({ id: "app.explorer.contractDetails" })}
        </h3>
      </AdminCardHeader>
      <AdminCardBody className="space-y-2">
        {vaults.map((vault) => (
          <div key={`contract-${vault.id}`} className={rowClass}>
            <p className="body-xs text-text-soft">
              {getVaultAssetSymbol(vault.asset, vault.chainId)}{" "}
              {formatMessage({ id: "app.explorer.vault" })}
            </p>
            <a
              href={getBlockExplorerAddressUrl(chainId, vault.vaultAddress)}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              <EnsAddressText address={vault.vaultAddress} />
              <RiExternalLinkLine className="h-3 w-3" />
            </a>
          </div>
        ))}
        {octantModuleAddress && !isZeroAddress(octantModuleAddress) && (
          <div className={rowClass}>
            <p className="body-xs text-text-soft">
              {formatMessage({ id: "app.explorer.vaultRegistry" })}
            </p>
            <a
              href={getBlockExplorerAddressUrl(chainId, octantModuleAddress)}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              <EnsAddressText address={octantModuleAddress} />
              <RiExternalLinkLine className="h-3 w-3" />
            </a>
          </div>
        )}
        {AAVE_V3_POOL[chainId] && (
          <div className={rowClass}>
            <p className="body-xs text-text-soft">
              {formatMessage({ id: "app.explorer.aavePool" })}
            </p>
            <a
              href={getBlockExplorerAddressUrl(chainId, AAVE_V3_POOL[chainId])}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              <EnsAddressText address={AAVE_V3_POOL[chainId]} />
              <RiExternalLinkLine className="h-3 w-3" />
            </a>
          </div>
        )}
      </AdminCardBody>
    </AdminCard>
  );
}
