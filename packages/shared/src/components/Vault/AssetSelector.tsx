import type { GardenVault } from "../../types/vaults";
import { getVaultAssetSymbol } from "../../utils/blockchain/vaults";

export interface AssetSelectorProps {
  vaults: GardenVault[];
  selectedAsset: string;
  onSelect: (assetAddress: string) => void;
  ariaLabel: string;
  /** Optional render function for a badge/indicator on each pill */
  renderBadge?: (vault: GardenVault) => React.ReactNode;
  /** Text size class (default: "text-sm") */
  size?: "sm" | "xs";
}

export function AssetSelector({
  vaults,
  selectedAsset,
  onSelect,
  ariaLabel,
  renderBadge,
  size = "sm",
}: AssetSelectorProps) {
  const textSize = size === "xs" ? "text-xs" : "text-sm";

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {vaults.map((vault) => {
        const isActive = selectedAsset.toLowerCase() === vault.asset.toLowerCase();
        return (
          <button
            key={vault.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(vault.asset)}
            className={`relative rounded-full border px-3 py-1.5 ${textSize} font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-1 ${
              isActive
                ? "border-primary-base bg-primary-base text-primary-foreground"
                : "border-stroke-sub bg-bg-white text-text-sub hover:bg-bg-weak"
            }`}
          >
            {getVaultAssetSymbol(vault.asset, vault.chainId)}
            {renderBadge?.(vault)}
          </button>
        );
      })}
    </div>
  );
}
