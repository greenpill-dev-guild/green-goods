import { type Address, AddressDisplay, useUser } from "@green-goods/shared";
import { RiWallet3Line } from "@remixicon/react";
import { QRCodeSVG } from "qrcode.react";
import { useIntl } from "react-intl";
import { EmptyState } from "@/components/Communication";

/**
 * "Receive" side of the Tokens tab: shows the signed-in user's wallet QR and a
 * copyable address so another gardener can scan or paste it to send funds.
 */
export function ReceiveView() {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();

  if (!primaryAddress) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<RiWallet3Line />}
          title={formatMessage({ id: "app.receive.unavailable" })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center">
      <p className="max-w-xs text-sm text-text-sub-600">
        {formatMessage({ id: "app.receive.instruction" })}
      </p>
      <div className="rounded-2xl border border-stroke-soft-200 bg-static-white p-4">
        <QRCodeSVG
          value={primaryAddress}
          size={192}
          marginSize={2}
          bgColor="var(--color-static-white)"
          fgColor="var(--color-static-black)"
          role="img"
          aria-label={formatMessage({ id: "app.receive.qrLabel" })}
        />
      </div>
      <AddressDisplay address={primaryAddress as Address} />
    </div>
  );
}
