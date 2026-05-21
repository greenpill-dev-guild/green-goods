import {
  cn,
  formatAddress,
  type Address,
  useCopyToClipboard,
  useEnsName,
} from "@green-goods/shared";
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { useIntl } from "react-intl";

type EnsAddressVariant = "default" | "card" | "long";

export function formatEnsAddressName(
  address: Address,
  ensName?: string | null,
  variant: EnsAddressVariant = "card"
): string {
  return formatAddress(address, {
    ensName,
    variant: ensName ? "default" : variant,
  });
}

interface EnsAddressTextProps {
  address: Address;
  fallbackName?: string | null;
  className?: string;
  variant?: EnsAddressVariant;
}

export function EnsAddressText({
  address,
  fallbackName,
  className,
  variant = "card",
}: EnsAddressTextProps) {
  const normalizedFallbackName = fallbackName?.trim();
  const { data: ensName } = useEnsName(normalizedFallbackName ? null : address);
  const displayName = normalizedFallbackName || formatEnsAddressName(address, ensName, variant);

  return <span className={className}>{displayName}</span>;
}

interface EnsAddressWithCopyProps extends EnsAddressTextProps {
  labelClassName?: string;
  buttonClassName?: string;
}

export function EnsAddressWithCopy({
  address,
  fallbackName,
  className,
  labelClassName,
  buttonClassName,
  variant = "card",
}: EnsAddressWithCopyProps) {
  const { formatMessage } = useIntl();
  const { copied, copy } = useCopyToClipboard();

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <EnsAddressText
        address={address}
        fallbackName={fallbackName}
        variant={variant}
        className={labelClassName}
      />
      <button
        type="button"
        onClick={() => copy(address)}
        className={cn(
          "rounded p-0.5 text-text-sub transition hover:bg-bg-weak hover:text-text-strong focus:outline-none focus:ring-1 focus:ring-primary-light",
          buttonClassName
        )}
        aria-label={formatMessage({ id: "app.common.copyAddress" })}
      >
        {copied ? (
          <RiCheckLine className="h-3 w-3 text-success-base" />
        ) : (
          <RiFileCopyLine className="h-3 w-3" />
        )}
      </button>
    </span>
  );
}
