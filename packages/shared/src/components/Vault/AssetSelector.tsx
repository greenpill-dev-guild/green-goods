import type { GardenVault } from "../../types/vaults";
import { getVaultAssetSymbol } from "../../utils/blockchain/vaults";
import { Chip } from "../Chip";

export interface AssetSelectorProps {
  vaults: GardenVault[];
  selectedAsset: string;
  onSelect: (assetAddress: string) => void;
  ariaLabel: string;
  /** Optional render function for a badge/indicator on each pill */
  renderBadge?: (vault: GardenVault) => React.ReactNode;
  /** Chip step: `sm` is the 32px compact chip, `xs` keeps the same chip with 12px text. */
  size?: "sm" | "xs";
}

/**
 * A radio group of shared chips, one per vault asset (DL-026): capsules at 32px
 * with a 44px finger box, the action fill with white text when selected
 * (DL-017), so the picker reads the same in the wallet sheet, the funding
 * panel, and the cockpit.
 */
export function AssetSelector({
  vaults,
  selectedAsset,
  onSelect,
  ariaLabel,
  renderBadge,
  size = "sm",
}: AssetSelectorProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {vaults.map((vault) => {
        const isActive = selectedAsset.toLowerCase() === vault.asset.toLowerCase();
        return (
          <Chip
            key={vault.id}
            role="radio"
            selected={isActive}
            aria-checked={isActive}
            tabIndex={0}
            onClick={() => onSelect(vault.asset)}
            className={size === "xs" ? "text-xs" : undefined}
          >
            {getVaultAssetSymbol(vault.asset, vault.chainId)}
            {renderBadge?.(vault)}
          </Chip>
        );
      })}
    </div>
  );
}
