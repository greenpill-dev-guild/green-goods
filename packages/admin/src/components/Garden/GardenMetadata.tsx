import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { getNetworkConfig } from "@green-goods/shared/config/blockchain";
import { useCopyToClipboard } from "@green-goods/shared/hooks/utils/useCopyToClipboard";
import type { Address } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiCheckLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiNftLine,
  RiWallet3Line,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton, AdminIconButton } from "@/components/AdminButton";
import { EnsAddressText } from "@/components/EnsAddressText";

interface GardenMetadataProps {
  gardenId: Address; // Garden smart account address
  tokenAddress: Address;
  tokenId: bigint | number;
  chainId: number;
  className?: string;
}

export const GardenMetadata: React.FC<GardenMetadataProps> = ({
  gardenId,
  tokenAddress,
  tokenId,
  chainId,
  className,
}) => {
  const { formatMessage } = useIntl();
  const { copied: copiedGarden, copy: copyGarden } = useCopyToClipboard({
    onSuccess: () =>
      toastService.success({
        title: formatMessage({
          id: "app.common.addressCopied",
          defaultMessage: "Address copied to clipboard",
        }),
      }),
  });
  const { copied: copiedToken, copy: copyToken } = useCopyToClipboard({
    onSuccess: () =>
      toastService.success({
        title: formatMessage({
          id: "app.common.addressCopied",
          defaultMessage: "Address copied to clipboard",
        }),
      }),
  });

  const networkConfig = getNetworkConfig(chainId);
  const blockExplorer = networkConfig.blockExplorer;

  const getExplorerUrl = (address: Address, type: "address" | "token" | "nft") => {
    if (!blockExplorer) return null;

    switch (type) {
      case "address":
        return `${blockExplorer}/address/${address}`;
      case "token":
        return `${blockExplorer}/token/${address}`;
      case "nft":
        return `${blockExplorer}/nft/${tokenAddress}/${tokenId}`;
      default:
        return `${blockExplorer}/address/${address}`;
    }
  };

  const getOpenSeaUrl = () => {
    // OpenSea URLs differ by chain
    const chainSlug =
      chainId === 11155111 ? "sepolia" : chainId === 42161 ? "arbitrum" : "ethereum";
    return `https://testnets.opensea.io/assets/${chainSlug}/${tokenAddress}/${tokenId}`;
  };

  return (
    <div
      className={cn(
        "grid gap-3 rounded-xl border border-stroke-soft bg-bg-white p-3 shadow-[var(--m3-elevation-1)] transition-shadow duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] hover:shadow-[var(--m3-elevation-2)] sm:p-4 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {/* Garden Smart Account */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 label-xs text-text-soft">
          <RiWallet3Line className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">
            {formatMessage({
              id: "admin.gardenMetadata.gardenAccount",
              defaultMessage: "Garden Account",
            })}
          </span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <code className="flex-1 truncate text-xs text-text-strong sm:text-sm">
            <EnsAddressText address={gardenId} />
          </code>
          <AdminIconButton
            className="flex-shrink-0"
            onClick={() => copyGarden(gardenId)}
            label={formatMessage({
              id: "admin.gardenMetadata.copyGardenAddress",
              defaultMessage: "Copy Garden Address",
            })}
          >
            {copiedGarden ? (
              <RiCheckLine className="h-4 w-4 text-success-dark" />
            ) : (
              <RiFileCopyLine className="h-4 w-4" />
            )}
          </AdminIconButton>
          {blockExplorer && (
            <AdminIconButton
              asChild
              variant="accent"
              className="flex-shrink-0"
              label={formatMessage({
                id: "admin.gardenMetadata.viewGardenOnExplorer",
                defaultMessage: "View Garden on Block Explorer",
              })}
            >
              <a
                href={getExplorerUrl(gardenId, "address") || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <RiExternalLinkLine />
              </a>
            </AdminIconButton>
          )}
        </div>
      </div>

      {/* Garden NFT */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 label-xs text-text-soft">
          <RiNftLine className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">
            {formatMessage({ id: "admin.gardenMetadata.gardenNFT", defaultMessage: "Garden NFT" })}
          </span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <code className="flex-1 truncate text-xs text-text-strong sm:text-sm">
            <EnsAddressText address={tokenAddress} /> #{tokenId.toString()}
          </code>
          <AdminIconButton
            className="flex-shrink-0"
            onClick={() => copyToken(`${tokenAddress}/${tokenId}`)}
            label={formatMessage({
              id: "admin.gardenMetadata.copyNFTId",
              defaultMessage: "Copy NFT Identifier",
            })}
          >
            {copiedToken ? (
              <RiCheckLine className="h-4 w-4 text-success-dark" />
            ) : (
              <RiFileCopyLine className="h-4 w-4" />
            )}
          </AdminIconButton>
          {blockExplorer && (
            <AdminIconButton
              asChild
              variant="accent"
              className="flex-shrink-0"
              label={formatMessage({
                id: "admin.gardenMetadata.viewNFTOnExplorer",
                defaultMessage: "View NFT on Block Explorer",
              })}
            >
              <a
                href={getExplorerUrl(tokenAddress, "nft") || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <RiExternalLinkLine />
              </a>
            </AdminIconButton>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-1">
        <div className="label-xs text-text-soft">
          {formatMessage({
            id: "admin.gardenMetadata.externalLinks",
            defaultMessage: "External Links",
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {blockExplorer && (
            <AdminButton asChild variant="outlined" size="md" leadingIcon={<RiExternalLinkLine />}>
              <a
                href={getExplorerUrl(tokenAddress, "token") || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {formatMessage({
                  id: "admin.gardenMetadata.tokenContract",
                  defaultMessage: "Token Contract",
                })}
              </a>
            </AdminButton>
          )}
          <AdminButton asChild variant="tonal" size="md" leadingIcon={<RiNftLine />}>
            <a href={getOpenSeaUrl()} target="_blank" rel="noopener noreferrer">
              OpenSea
            </a>
          </AdminButton>
        </div>
      </div>
    </div>
  );
};
