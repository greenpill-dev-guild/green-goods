import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { type ReactNode, useId, useState } from "react";
import { useIntl } from "react-intl";
import { useEnsName } from "../hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "../hooks/ens/useGreenGoodsEnsName";
import { useTimeout } from "../hooks/utils/useTimeout";
import { logger } from "../modules/app/logger";
import type { Address } from "../types/domain";
import { copyToClipboard } from "../utils/app/clipboard";
import { formatAddress } from "../utils/app/text";
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
  /**
   * For a caller that builds its own element around the name, such as a row's title or a
   * chip: it receives the name this display would show (the Green Goods name, then the ENS
   * name, then a short address) and renders it, with no popover or copy button.
   */
  children?: (name: string) => ReactNode;
  /**
   * One name in a list of people: its Green Goods name is read with the list's other rows,
   * in one batch, rather than on its own.
   */
  list?: boolean;
}

export function AddressDisplay({
  address,
  className,
  showCopyButton = true,
  interactive = true,
  fallbackLabel,
  children,
  list = false,
}: AddressDisplayProps) {
  const intl = useIntl();
  const [copied, setCopied] = useState(false);
  const tooltipId = useId();
  const { data: ensName } = useEnsName(address);
  const { data: protocolName } = useGreenGoodsEnsName(address, { list });
  const preferredName = protocolName || ensName;
  const display =
    !preferredName && fallbackLabel
      ? fallbackLabel
      : formatAddress(address, {
          ensName: preferredName,
          variant: preferredName ? "default" : "card",
        });

  // Auto-cleanup timer via useTimeout (Rule 1)
  const { set: scheduleCopyReset } = useTimeout();

  if (children) return <>{children(display)}</>;

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
