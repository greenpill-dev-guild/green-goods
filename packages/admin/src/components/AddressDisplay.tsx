import { cn, copyToClipboard, formatAddress } from "@green-goods/shared/utils";
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { useEffect, useId, useState } from "react";

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
  const tooltipId = useId();
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
      <button
        type="button"
        popovertarget={tooltipId}
        className="text-sm font-mono text-text-strong hover:text-text-sub transition-colors focus:outline-none focus:ring-2 focus:ring-primary-base/20 rounded"
        style={{ background: "none", border: "none", padding: 0 }}
      >
        {display}
      </button>

      <div
        id={tooltipId}
        // @ts-expect-error - popover is a valid HTML attribute but not in React types yet
        popover="hint"
        className="px-2 py-1 bg-bg-strong text-static-white text-xs rounded whitespace-nowrap m-0 border-0"
        style={{
          inset: "unset",
          margin: "unset",
        }}
      >
        {ensName ? (
          <div className="flex flex-col text-left">
            <span>{ensName}</span>
            <span className="text-[10px] text-text-disabled">{address}</span>
          </div>
        ) : (
          address
        )}
      </div>

      {showCopyButton && (
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 text-text-soft hover:text-text-sub transition-colors focus:outline-none focus:ring-2 focus:ring-primary-base/20 rounded"
          title="Copy address"
        >
          {copied ? (
            <RiCheckLine className="h-3 w-3 text-success-dark" />
          ) : (
            <RiFileCopyLine className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );
}
