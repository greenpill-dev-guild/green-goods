import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { useAddressDisplayName } from "../hooks/ens/useAddressDisplayName";
import { useTimeout } from "../hooks/utils/useTimeout";
import { logger } from "../modules/app/logger";
import type { Address } from "../types/domain";
import { copyToClipboard } from "../utils/app/clipboard";
import { cn } from "../utils/styles/cn";
import { IconButton } from "./IconButton";

export interface AddressDisplayProps {
  address: Address;
  className?: string;
  showCopyButton?: boolean;
  /**
   * false renders a plain resolved-name span — no popover trigger, no copy
   * button — for use inside another interactive element (a row that is itself
   * a button), where nested buttons would be invalid HTML.
   */
  interactive?: boolean;
  /** A role label for public readers when a name has not been published. */
  fallbackLabel?: string;
}

export function AddressDisplay({
  address,
  className,
  showCopyButton = true,
  interactive = true,
  fallbackLabel,
}: AddressDisplayProps) {
  const intl = useIntl();
  const [copied, setCopied] = useState(false);
  const tooltipId = useId();
  const { preferredName, display: name } = useAddressDisplayName(address);
  const display = !preferredName && fallbackLabel ? fallbackLabel : name;

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

  if (!interactive) {
    return (
      <span
        className={cn("font-mono text-sm text-text-strong", className)}
        title={preferredName ? `${preferredName} · ${address}` : address}
      >
        {display}
      </span>
    );
  }

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
        {preferredName ? (
          <div className="flex flex-col text-left">
            <span>{preferredName}</span>
            <span className="text-[10px] text-text-disabled">{address}</span>
          </div>
        ) : (
          address
        )}
      </div>

      {showCopyButton && (
        <IconButton
          size="compact"
          className="-my-1.5 text-text-soft"
          onClick={handleCopy}
          aria-label={intl.formatMessage({
            id: "app.common.copyAddress",
            defaultMessage: "Copy Address",
          })}
          title={intl.formatMessage({
            id: "app.common.copyAddress",
            defaultMessage: "Copy Address",
          })}
          icon={copied ? <RiCheckLine className="text-success-dark" /> : <RiFileCopyLine />}
        />
      )}
    </div>
  );
}
