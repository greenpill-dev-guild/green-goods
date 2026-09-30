import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import type { Address } from "@green-goods/shared/types/domain";
import { isZeroAddress } from "@green-goods/shared/utils/blockchain/address";
import { getNetworkContracts } from "@green-goods/shared/utils/blockchain/contracts";
import { AAVE_V3_POOL, getVaultAssetSymbol } from "@green-goods/shared/utils/blockchain/vaults";
import { getBlockExplorerAddressUrl } from "@green-goods/shared/utils/eas/explorers";
import { RiExternalLinkLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminCardTitle } from "@/components/AdminCard";
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
 * rail, and sit in the card as plain rows rather than boxes of their own (D33). Labels name what
 * each contract does for the steward, not its protocol (D31). Self-fetches via
 * `useGardenVaults`; React Query dedupes with the main view's read.
 */
export function VaultContractDetails({ gardenAddress }: VaultContractDetailsProps) {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const octantModuleAddress = getNetworkContracts(chainId).octantModule as Address | undefined;
  const { vaults } = useGardenVaults(gardenAddress, { enabled: Boolean(gardenAddress) });

  if (vaults.length === 0) return null;

  const rowClass = "py-2";
  const linkClass =
    "mt-0.5 inline-flex items-center gap-1 body-xs text-primary-dark hover:underline";

  return (
    <AdminCard density="none">
      <AdminCardHeader>
        <div>
          <AdminCardTitle>{formatMessage({ id: "app.explorer.contractDetails" })}</AdminCardTitle>
          <p className="mt-1 body-sm text-text-sub">
            {formatMessage({ id: "app.explorer.contractDetailsDescription" })}
          </p>
        </div>
      </AdminCardHeader>
      <AdminCardBody>
        <dl className="divide-y divide-stroke-soft">
          {vaults.map((vault) => (
            <div key={`contract-${vault.id}`} className={rowClass}>
              <dt className="body-xs text-text-soft">
                {getVaultAssetSymbol(vault.asset, vault.chainId)}{" "}
                {formatMessage({ id: "app.explorer.vault" })}
              </dt>
              <dd>
                <a
                  href={getBlockExplorerAddressUrl(chainId, vault.vaultAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  <EnsAddressText address={vault.vaultAddress} />
                  <RiExternalLinkLine className="h-3 w-3" />
                </a>
              </dd>
            </div>
          ))}
          {octantModuleAddress && !isZeroAddress(octantModuleAddress) && (
            <div className={rowClass}>
              <dt className="body-xs text-text-soft">
                {formatMessage({ id: "app.explorer.vaultRegistry" })}
              </dt>
              <dd>
                <a
                  href={getBlockExplorerAddressUrl(chainId, octantModuleAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  <EnsAddressText address={octantModuleAddress} />
                  <RiExternalLinkLine className="h-3 w-3" />
                </a>
              </dd>
            </div>
          )}
          {AAVE_V3_POOL[chainId] && (
            <div className={rowClass}>
              <dt className="body-xs text-text-soft">
                {formatMessage({ id: "app.explorer.aavePool" })}
              </dt>
              <dd>
                <a
                  href={getBlockExplorerAddressUrl(chainId, AAVE_V3_POOL[chainId])}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  <EnsAddressText address={AAVE_V3_POOL[chainId]} />
                  <RiExternalLinkLine className="h-3 w-3" />
                </a>
              </dd>
            </div>
          )}
        </dl>
      </AdminCardBody>
    </AdminCard>
  );
}
