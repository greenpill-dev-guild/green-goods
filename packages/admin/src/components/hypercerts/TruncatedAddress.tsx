import { type Address, truncateAddress, useCopyToClipboard } from "@green-goods/shared";
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { useIntl } from "react-intl";

interface TruncatedAddressProps {
  address: Address;
}

/** Displays truncated Ethereum address with copy button. Admin-local primitive. */
export function TruncatedAddress({ address }: TruncatedAddressProps) {
  const { formatMessage } = useIntl();
  const { copied, copy } = useCopyToClipboard();

  return (
    <span className="inline-flex items-center gap-1">
      <span title={address} className="font-mono text-xs">
        {truncateAddress(address)}
      </span>
      <button
        type="button"
        onClick={() => copy(address)}
        className="rounded p-0.5 text-text-sub transition hover:bg-bg-weak hover:text-text-strong focus:outline-none focus:ring-1 focus:ring-primary-light"
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
