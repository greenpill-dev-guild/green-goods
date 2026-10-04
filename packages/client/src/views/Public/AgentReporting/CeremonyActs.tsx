import { Button } from "@green-goods/shared/components/Button";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { RiLogoutBoxRLine, RiUserFollowLine, RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { FlowForward } from "@/components/Features/Work";
import {
  AccountRow,
  ManagePermissionsLink,
  SignedOutRow,
} from "@/components/Navigation/FocusedAccountSheet";
import { FocusedHeaderAccount } from "@/components/Navigation/FocusedSiteHeader";
import { PairedActs } from "./CeremonyBar";

/** "Connected as …", with the whole address a hover away. */
export function AccountLine({ account }: { account: string }) {
  const intl = useIntl();
  return (
    <span title={account}>
      {intl.formatMessage(
        { id: "public.reporting.connect.as", defaultMessage: "Connected as {account}" },
        { account: formatAddress(account) }
      )}
    </span>
  );
}

/** Connect or prove the account selected for this browser challenge. */
export function AccountActions({
  account,
  connecting,
  proving,
  onConnectWallet,
  onConnectPasskey,
  passkeyUnavailable = false,
  onProve,
}: {
  account: string | null;
  connecting: boolean;
  proving: boolean;
  onConnectWallet: () => void;
  onConnectPasskey: () => void;
  passkeyUnavailable?: boolean;
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
      passkeyUnavailable={passkeyUnavailable}
    />
  );
}

/** Connect the wallet or passkey the person already uses with Green Goods. */
export function ConnectActions({
  connecting,
  onConnectWallet,
  onConnectPasskey,
  passkeyUnavailable = false,
}: {
  connecting: boolean;
  onConnectWallet: () => void;
  onConnectPasskey: () => void;
  passkeyUnavailable?: boolean;
}) {
  const intl = useIntl();
  return (
    <PairedActs>
      <Button
        size="lg"
        loading={connecting}
        disabled={passkeyUnavailable}
        onClick={onConnectPasskey}
      >
        {intl.formatMessage({
          id: "public.reporting.connect.passkey",
          defaultMessage: "Use Passkey",
        })}
      </Button>
      <Button size="lg" emphasis="secondary" disabled={connecting} onClick={onConnectWallet}>
        {intl.formatMessage({
          id: "public.reporting.connect.wallet",
          defaultMessage: "Use Wallet",
        })}
      </Button>
    </PairedActs>
  );
}

/**
 * The page's account, said in the top bar's sheet and not on the page: which account the page is
 * signed in as, or only connected to so far, where it was opened from, and what can be done about
 * it. With no account it says no one is signed in, or connected, yet.
 */
export function PageAccount({
  account,
  signedIn,
  signsIn = true,
  channel = null,
  permissionsLink = true,
  onLeave,
}: {
  account: string | null;
  /** The page holds a session for the account, which the profile button marks. */
  signedIn: boolean;
  /** Off on the permissions page, which works on a connected account with no session. */
  signsIn?: boolean;
  /** The chat app the link came from, once the page knows it. */
  channel?: string | null;
  /** Off on the permissions page itself. */
  permissionsLink?: boolean;
  /** Ends the session, when the page can end it now. */
  onLeave?: () => void;
}) {
  const intl = useIntl();
  return (
    <FocusedHeaderAccount signedIn={signedIn && account !== null}>
      {account ? (
        <>
          <AccountRow
            icon={
              signedIn ? <RiUserFollowLine aria-hidden="true" /> : <RiUserLine aria-hidden="true" />
            }
            title={intl.formatMessage(
              signedIn
                ? {
                    id: "public.reporting.account.signedIn",
                    defaultMessage: "Signed in to this page",
                  }
                : signsIn
                  ? {
                      id: "public.reporting.account.connected",
                      defaultMessage: "Connected, not signed in yet",
                    }
                  : { id: "app.account.statusConnected", defaultMessage: "Connected" }
            )}
          >
            <span className="block font-mono" title={account}>
              {formatAddress(account)}
            </span>
            {channel ? (
              <span className="block">
                {intl.formatMessage(
                  { id: "public.reporting.eyebrow", defaultMessage: "From your {channel} chat" },
                  { channel }
                )}
              </span>
            ) : null}
          </AccountRow>
          {permissionsLink ? <ManagePermissionsLink /> : null}
          {onLeave ? (
            <Button
              emphasis="secondary"
              className="w-full"
              leadingIcon={<RiLogoutBoxRLine className="h-5 w-5" aria-hidden="true" />}
              onClick={onLeave}
            >
              {intl.formatMessage({
                id: "public.reporting.leave",
                defaultMessage: "Sign Out of This Page",
              })}
            </Button>
          ) : null}
        </>
      ) : signsIn ? (
        <>
          <SignedOutRow />
          {permissionsLink ? <ManagePermissionsLink /> : null}
        </>
      ) : (
        // The permissions page never asks anyone to sign in, only to connect.
        <AccountRow
          icon={<RiUserLine aria-hidden="true" />}
          title={intl.formatMessage({
            id: "public.reporting.account.notConnected",
            defaultMessage: "Not connected yet",
          })}
        >
          {intl.formatMessage({
            id: "public.reporting.account.notConnectedBody",
            defaultMessage: "Connect your wallet or passkey to check its permissions.",
          })}
        </AccountRow>
      )}
    </FocusedHeaderAccount>
  );
}
