import { useState } from "react";
import { RiFileCopyLine, RiCheckLine } from "@remixicon/react";
import { cn } from "@green-goods/shared/utils";

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
  truncateLength = 6,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const truncatedAddress = `${address.slice(0, truncateLength)}...${address.slice(-truncateLength)}`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
        <span className="text-sm font-mono cursor-pointer">{truncatedAddress}</span>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
            {address}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        )}
      </div>

      {showCopyButton && (
        <button
          onClick={handleCopy}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
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
