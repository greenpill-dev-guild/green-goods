import {
  type Address,
  debugError,
  hapticLight,
  toastService,
  useAuth,
  useEnsName,
  usePrimaryAddress,
} from "@green-goods/shared";
import { RiAlertLine, RiKeyLine, RiLogoutBoxRLine, RiWalletLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Actions";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
import { AddressCopy } from "@/components/Inputs";

export const AccountInfo: React.FC = () => {
  const { authMode, signOut, credential, walletAddress, embeddedAddress } = useAuth();
  const primaryAddress = usePrimaryAddress();
  const { data: primaryEnsName } = useEnsName(primaryAddress);
  const navigate = useNavigate();
  const intl = useIntl();

  const handleLogout = async () => {
    hapticLight();
    try {
      await signOut?.();
      navigate("/login", { replace: true, state: { fromLogout: true }, viewTransition: true });
      toastService.success({
        title: intl.formatMessage({
          id: "app.account.sessionClosed",
          defaultMessage: "Signed out",
        }),
        context: "logout",
        suppressLogging: true,
      });
    } catch (err) {
      debugError("Logout failed", err);
      toastService.error({
        title: intl.formatMessage({
          id: "app.account.logoutFailed",
          defaultMessage: "Failed to log out",
        }),
        message: intl.formatMessage({
          id: "app.account.logoutRetry",
          defaultMessage: "Please try again.",
        }),
        context: "logout",
        error: err,
      });
    }
  };

  return (
    <>
      <h5 className="text-label-md text-text-strong-950">
        {intl.formatMessage({
          id: "app.profile.account",
          defaultMessage: "Account",
        })}
      </h5>

      <Card>
        <div className="flex items-center gap-3 w-full">
          <Avatar>
            <div className="flex items-center justify-center text-center mx-auto text-primary">
              {authMode === "passkey" ? (
                <RiKeyLine className="w-4" />
              ) : (
                <RiWalletLine className="w-4" />
              )}
            </div>
          </Avatar>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="text-sm font-medium truncate">
              {authMode === "passkey"
                ? intl.formatMessage({
                    id: "app.account.passkey",
                    defaultMessage: "Passkey Wallet",
                  })
                : intl.formatMessage({
                    id: "app.account.wallet",
                    defaultMessage: "External Wallet",
                  })}
            </div>
            <div className="text-xs text-text-sub-600">
              {authMode === "passkey" && credential
                ? "Active"
                : (authMode === "wallet" && walletAddress) ||
                    (authMode === "embedded" && embeddedAddress)
                  ? "Connected"
                  : "Not configured"}
            </div>
          </div>
        </div>
      </Card>

      {primaryAddress && (
        <Card>
          <div className="flex items-center gap-3 w-full">
            <Avatar>
              <div className="flex items-center justify-center text-center mx-auto text-primary">
                <RiWalletLine className="w-4" />
              </div>
            </Avatar>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="text-sm font-medium truncate">
                {intl.formatMessage({
                  id: "app.account.address",
                  defaultMessage:
                    authMode === "passkey" ? "Smart Account Address" : "Wallet Address",
                })}
              </div>
            </div>
            <AddressCopy
              address={primaryAddress as Address}
              ensName={primaryEnsName}
              size="compact"
              className="w-auto shrink-0"
            />
          </div>
        </Card>
      )}

      {authMode === "passkey" && (
        <div className="rounded-md border border-warning-light bg-warning-lighter px-3 py-2.5 text-xs text-warning-dark">
          <p className="font-medium flex items-center gap-1.5">
            <RiAlertLine className="w-3.5 h-3.5 shrink-0" />
            {intl.formatMessage({
              id: "app.identity.passkeyWarning.title",
              defaultMessage: "Passkey stored locally",
            })}
          </p>
          <p className="mt-1 leading-relaxed">
            {intl.formatMessage({
              id: "app.identity.passkeyWarning.message",
              defaultMessage:
                "Your passkey is stored on this device's browser storage. Clearing browser data or uninstalling the app will permanently remove access to this account.",
            })}
          </p>
          <p className="mt-1 leading-relaxed">
            {intl.formatMessage({
              id: "app.identity.passkeyWarning.guidance",
              defaultMessage:
                "For persistent access across devices, consider switching to wallet-based login.",
            })}
          </p>
        </div>
      )}

      <Button
        variant="neutral"
        mode="stroke"
        size="small"
        onClick={handleLogout}
        label={intl.formatMessage({
          id: "app.profile.logout",
          defaultMessage: "Logout",
        })}
        leadingIcon={<RiLogoutBoxRLine className="w-4" />}
        className="w-full"
      />
    </>
  );
};
