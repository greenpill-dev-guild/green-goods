import { cn, copyToClipboard, formatAddress } from "@green-goods/shared/utils";
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { useEffect, useState } from "react";

interface AddressDisplayProps {
  address: string;
  className?: string;
  showCopyButton?: boolean;
  truncateLength?: number;
}

export function AddressDisplay({
  address,
  className,
  showCopyButton = true,
  truncateLength: _truncateLength = 6,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  // ENS temporarily disabled to fix QueryClient initialization
  const ensName = null;
  const display = formatAddress(address, {
    ensName,
    variant: ensName ? "default" : "card",
  });

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await copyToClipboard(address);
      setCopied(true);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="text-sm font-mono cursor-pointer text-text-strong">{display}</span>

        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-bg-strong text-white text-xs rounded whitespace-nowrap z-50">
            {ensName ? (
              <div className="flex flex-col text-left">
                <span>{ensName}</span>
                <span className="text-[10px] text-gray-300">{address}</span>
              </div>
            ) : (
              address
            )}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>

      {showCopyButton && (
        <button
          onClick={handleCopy}
          className="p-1 text-text-soft hover:text-text-sub transition-colors"
          title="Copy address"
        >
          {copied ? (
            <RiCheckLine className="h-3 w-3 text-green-600" />
          ) : (
            <RiFileCopyLine className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );
}
