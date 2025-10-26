import {
  cn,
  copyToClipboard,
  type FormatAddressVariant,
  formatAddress,
} from "@green-goods/shared/utils";
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import React, { useEffect, useId, useState } from "react";
import toast from "react-hot-toast";
import { useIntl } from "react-intl";

interface AddressCopyProps {
  address?: string | null;
  ensName?: string | null;
  className?: string;
  size?: "default" | "compact";
  icon?: React.ReactNode;
  variant?: FormatAddressVariant;
}

/**
 * Touch-friendly copy surface for addresses with ENS support.
 */
export function AddressCopy({
  address,
  ensName,
  className,
  size = "default",
  icon,
  variant = "default",
}: AddressCopyProps) {
  const intl = useIntl();
  const [copied, setCopied] = useState(false);
  const statusId = useId();

  if (!address) return null;

  const displayValue = formatAddress(address, { variant, ensName });

  const handleCopy = async () => {
    try {
      await copyToClipboard(address);
      setCopied(true);
      toast.success(intl.formatMessage({ id: "app.toast.copied", defaultMessage: "Copied" }));
    } catch {
      toast.error(
        intl.formatMessage({ id: "app.toast.copyFailed", defaultMessage: "Copy failed" })
      );
    }
  };

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const sizeClasses = size === "compact" ? "px-3 py-2 min-h-[40px]" : "px-4 py-3 min-h-[48px]";

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={handleCopy}
        aria-labelledby={statusId}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-150",
          "hover:border-primary/40 hover:shadow-md active:scale-[0.99]",
          "focus:outline-none focus:ring-2 focus:ring-primary/30",
          sizeClasses
        )}
      >
        <span className="flex items-center gap-2 text-sm text-slate-700">
          {icon ? <span className="text-primary">{icon}</span> : null}
          <span className="font-mono text-xs sm:text-sm">{displayValue}</span>
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-primary">
          {copied ? <RiCheckLine className="h-4 w-4" /> : <RiFileCopyLine className="h-4 w-4" />}
          <span>
            {copied
              ? intl.formatMessage({ id: "app.toast.copied", defaultMessage: "Copied" })
              : intl.formatMessage({ id: "app.common.copy", defaultMessage: "Copy" })}
          </span>
        </span>
      </button>
      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {copied
          ? `${intl.formatMessage({ id: "app.toast.copied", defaultMessage: "Copied" })} ${displayValue}`
          : ""}
      </span>
    </div>
  );
}
