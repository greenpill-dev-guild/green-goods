import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useCopyToClipboard } from "@green-goods/shared/hooks/utils/useCopyToClipboard";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { cn } from "@green-goods/shared/utils/styles/cn";
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
          "rounded p-0.5 text-text-sub transition hover:bg-bg-weak hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]",
          buttonClassName
        )}
        aria-label={formatMessage({ id: "app.common.copyAddress" })}
      >
        {copied ? (
          <RiCheckLine className="h-3 w-3 text-success-dark" />
        ) : (
          <RiFileCopyLine className="h-3 w-3" />
        )}
      </button>
    </span>
  );
}
