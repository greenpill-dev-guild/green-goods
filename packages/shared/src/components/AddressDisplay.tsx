import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { useEnsName } from "../hooks/blockchain/useEnsName";
import { useTimeout } from "../hooks/utils/useTimeout";
import { logger } from "../modules";
import type { Address } from "../types";
import { cn, copyToClipboard, formatAddress } from "../utils";

export interface AddressDisplayProps {
  address: Address;
  className?: string;
  showCopyButton?: boolean;
}

export function AddressDisplay({ address, className, showCopyButton = true }: AddressDisplayProps) {
  const intl = useIntl();
  const [copied, setCopied] = useState(false);
  const tooltipId = useId();
  const { data: ensName } = useEnsName(address);
  const display = formatAddress(address, {
    ensName,
    variant: ensName ? "default" : "card",
  });

  // Auto-cleanup timer via useTimeout (Rule 1)
  const { set: scheduleCopyReset } = useTimeout();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await copyToClipboard(address);
      setCopied(true);
      scheduleCopyReset(() => setCopied(false), 2000);
    } catch (err) {
      logger.error("Failed to copy address", { error: err });
    }
  };

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <button
        type="button"
        popoverTarget={tooltipId}
        className="text-sm font-mono text-text-strong hover:text-text-sub transition-colors focus:outline-none focus:ring-2 focus:ring-primary-base/40 rounded"
        style={{ background: "none", border: "none", padding: 0 }}
      >
        {display}
      </button>

      <div
        id={tooltipId}
        popover="hint"
        className="px-2 py-1 bg-bg-sub text-text-strong text-xs rounded whitespace-nowrap m-0 border-0"
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
          className="p-1 text-text-soft hover:text-text-sub transition-colors focus:outline-none focus:ring-2 focus:ring-primary-base/40 rounded"
          title={intl.formatMessage({
            id: "app.common.copyAddress",
            defaultMessage: "Copy address",
          })}
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
