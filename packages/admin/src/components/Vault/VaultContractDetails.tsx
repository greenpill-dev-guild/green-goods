import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
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

  const addressLink = (address: Address) => (
    <a
      href={getBlockExplorerAddressUrl(chainId, address)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-normal text-primary-dark hover:underline"
    >
      <EnsAddressText address={address} />
      <RiExternalLinkLine className="h-3 w-3" />
    </a>
  );

  return (
    <AdminCard density="none">
      <AdminCardHeader>
        <div>
          <AdminCardTitle>{formatMessage({ id: "app.explorer.contractDetails" })}</AdminCardTitle>
          <p className="mt-1 type-body text-text-sub">
            {formatMessage({ id: "app.explorer.contractDetailsDescription" })}
          </p>
        </div>
      </AdminCardHeader>
      <AdminCardBody>
        <FactList frame="inset">
          {vaults.map((vault) => (
            <FactRow
              key={`contract-${vault.id}`}
              label={`${getVaultAssetSymbol(vault.asset, vault.chainId)} ${formatMessage({ id: "app.explorer.vault" })}`}
              value={addressLink(vault.vaultAddress)}
            />
          ))}
          {octantModuleAddress && !isZeroAddress(octantModuleAddress) && (
            <FactRow
              label={formatMessage({ id: "app.explorer.vaultRegistry" })}
              value={addressLink(octantModuleAddress)}
            />
          )}
          {AAVE_V3_POOL[chainId] && (
            <FactRow
              label={formatMessage({ id: "app.explorer.aavePool" })}
              value={addressLink(AAVE_V3_POOL[chainId])}
            />
          )}
        </FactList>
      </AdminCardBody>
    </AdminCard>
  );
}
