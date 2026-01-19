import { getNetworkConfig } from "@green-goods/shared/config/blockchain";
import { cn, copyToClipboard } from "@green-goods/shared/utils";
import {
  RiCheckLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiNftLine,
  RiWallet3Line,
} from "@remixicon/react";
import { useState } from "react";

interface GardenMetadataProps {
  gardenId: string; // Garden smart account address
  tokenAddress: string;
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
  const [copiedGarden, setCopiedGarden] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const networkConfig = getNetworkConfig(chainId);
  const blockExplorer = networkConfig.blockExplorer;

  const handleCopy = async (text: string, setCopied: (val: boolean) => void) => {
    try {
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getExplorerUrl = (address: string, type: "address" | "token" | "nft") => {
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
    const chainSlug = chainId === 84532 ? "base-sepolia" : chainId === 42161 ? "arbitrum" : "base";
    return `https://testnets.opensea.io/assets/${chainSlug}/${tokenAddress}/${tokenId}`;
  };

  return (
    <div
      className={cn(
        "grid gap-3 rounded-lg border border-stroke-soft bg-bg-white p-3 shadow-md transition-shadow duration-200 hover:shadow-md sm:p-4 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {/* Garden Smart Account */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-text-soft">
          <RiWallet3Line className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">Garden Account</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <code className="flex-1 truncate text-xs font-mono text-text-strong sm:text-sm">
            <span className="inline sm:hidden">
              {gardenId.slice(0, 6)}...{gardenId.slice(-4)}
            </span>
            <span className="hidden sm:inline">
              {gardenId.slice(0, 10)}...{gardenId.slice(-8)}
            </span>
          </code>
          <button
            onClick={() => handleCopy(gardenId, setCopiedGarden)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded p-2 text-text-soft transition hover:bg-bg-weak hover:text-text-sub active:scale-95"
            title="Copy address"
            type="button"
            aria-label="Copy garden address"
          >
            {copiedGarden ? (
              <RiCheckLine className="h-4 w-4 text-success-dark" />
            ) : (
              <RiFileCopyLine className="h-4 w-4" />
            )}
          </button>
          {blockExplorer && (
            <a
              href={getExplorerUrl(gardenId, "address") || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded p-2 text-information-dark transition hover:bg-information-lighter active:scale-95"
              title="View on block explorer"
              aria-label="View garden on block explorer"
            >
              <RiExternalLinkLine className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Garden NFT */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-text-soft">
          <RiNftLine className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">Garden NFT</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <code className="flex-1 truncate text-xs font-mono text-text-strong sm:text-sm">
            <span className="inline sm:hidden">
              {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)} #{tokenId.toString()}
            </span>
            <span className="hidden sm:inline">
              {tokenAddress.slice(0, 10)}...{tokenAddress.slice(-8)} #{tokenId.toString()}
            </span>
          </code>
          <button
            onClick={() => handleCopy(`${tokenAddress}/${tokenId}`, setCopiedToken)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded p-2 text-text-soft transition hover:bg-bg-weak hover:text-text-sub active:scale-95"
            title="Copy NFT identifier"
            type="button"
            aria-label="Copy NFT identifier"
          >
            {copiedToken ? (
              <RiCheckLine className="h-4 w-4 text-success-dark" />
            ) : (
              <RiFileCopyLine className="h-4 w-4" />
            )}
          </button>
          {blockExplorer && (
            <a
              href={getExplorerUrl(tokenAddress, "nft") || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded p-2 text-information-dark transition hover:bg-information-lighter active:scale-95"
              title="View NFT on block explorer"
              aria-label="View NFT on block explorer"
            >
              <RiExternalLinkLine className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-1">
        <div className="text-xs uppercase tracking-wide text-text-soft">External Links</div>
        <div className="flex flex-wrap gap-2">
          {blockExplorer && (
            <a
              href={getExplorerUrl(tokenAddress, "token") || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-stroke-sub bg-bg-white px-4 py-2.5 text-xs font-medium text-text-sub transition hover:bg-bg-weak active:scale-95"
            >
              <RiExternalLinkLine className="h-4 w-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Token Contract</span>
            </a>
          )}
          <a
            href={getOpenSeaUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-information-light bg-information-lighter px-4 py-2.5 text-xs font-medium text-information-dark transition hover:bg-information-light active:scale-95"
          >
            <RiNftLine className="h-4 w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">OpenSea</span>
          </a>
        </div>
      </div>
    </div>
  );
};
