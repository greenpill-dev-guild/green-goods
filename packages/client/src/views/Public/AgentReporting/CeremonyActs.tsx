import { Button } from "@green-goods/shared/components/Button";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { RiExternalLinkLine, RiLogoutBoxRLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { FlowForward } from "@/components/Features/Work";
import { PairedActs } from "./CeremonyBar";

/** "Connected as …" for the account in the browser, "From account …" for the one that signs. */
export function AccountLine({
  account,
  relation,
}: {
  account: string;
  relation: "connected" | "signer";
}) {
  const intl = useIntl();
  return (
    <span title={account}>
      {intl.formatMessage(
        relation === "connected"
          ? { id: "public.reporting.connect.as", defaultMessage: "Connected as {account}" }
          : { id: "public.reporting.review.signer", defaultMessage: "From account {account}" },
        { account: formatAddress(account) }
      )}
    </span>
  );
}

/** Connect or prove an existing account; this page never creates one. */
export function AccountActions({
  account,
  connecting,
  proving,
  onConnectWallet,
  onConnectPasskey,
  onProve,
}: {
  account: string | null;
  connecting: boolean;
  proving: boolean;
  onConnectWallet: () => void;
  onConnectPasskey: () => void;
  onProve: () => void;
}) {
  const intl = useIntl();
  if (account) {
    return (
      <FlowForward
        label={intl.formatMessage({
          id: "public.reporting.connect.sign",
          defaultMessage: "Sign to Continue",
        })}
        onClick={onProve}
        loading={proving}
      />
    );
  }
  return (
    <ConnectActions
      connecting={connecting}
      onConnectWallet={onConnectWallet}
      onConnectPasskey={onConnectPasskey}
    />
  );
}

/** Connect the wallet or passkey the person already uses with Green Goods. */
export function ConnectActions({
  connecting,
  onConnectWallet,
  onConnectPasskey,
}: {
  connecting: boolean;
  onConnectWallet: () => void;
  onConnectPasskey: () => void;
}) {
  const intl = useIntl();
  return (
    <PairedActs>
      <Button size="lg" loading={connecting} onClick={onConnectWallet}>
        {intl.formatMessage({
          id: "public.reporting.connect.wallet",
          defaultMessage: "Connect Wallet",
        })}
      </Button>
      <Button size="lg" emphasis="secondary" disabled={connecting} onClick={onConnectPasskey}>
        {intl.formatMessage({
          id: "public.reporting.connect.passkey",
          defaultMessage: "Use My Passkey",
        })}
      </Button>
    </PairedActs>
  );
}

/** Opens the owner permissions page beside the ceremony, never in its place. */
export function ManagePermissionsLink() {
  const intl = useIntl();
  return (
    <Button
      emphasis="secondary"
      className="w-full sm:w-auto"
      leadingIcon={<RiExternalLinkLine className="h-5 w-5" aria-hidden="true" />}
      asChild
    >
      <a href="/agent/reporting/permissions" target="_blank" rel="noopener noreferrer">
        {intl.formatMessage({
          id: "public.reporting.grant.manage",
          defaultMessage: "Manage Permissions",
        })}
        <span className="sr-only">
          {intl.formatMessage({
            id: "public.reporting.opensInNewTab",
            defaultMessage: "(opens in a new tab)",
          })}
        </span>
      </a>
    </Button>
  );
}

/** Ends this browser's access to the request, for a shared phone or computer. */
export function SignOutButton({ onLeave }: { onLeave: () => void }) {
  const intl = useIntl();
  return (
    <Button
      emphasis="secondary"
      className="w-full sm:w-auto"
      leadingIcon={<RiLogoutBoxRLine className="h-5 w-5" aria-hidden="true" />}
      onClick={onLeave}
    >
      {intl.formatMessage({
        id: "public.reporting.leave",
        defaultMessage: "Sign Out of This Page",
      })}
    </Button>
  );
}
