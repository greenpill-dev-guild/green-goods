import {
  type Address,
  debugError,
  hapticLight,
  toastService,
  useAuthActions,
  useAuthState,
  useEnsName,
  usePrimaryAddress,
} from "@green-goods/shared";
import {
  RiAlertLine,
  RiKeyLine,
  RiLogoutBoxRLine,
  RiUserLine,
  RiWalletLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Actions";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
import { AddressCopy } from "@/components/Inputs";

export const AccountInfo: React.FC = () => {
  const { authMode, credential, walletAddress, embeddedAddress } = useAuthState();
  const { signOut } = useAuthActions();
  const primaryAddress = usePrimaryAddress();
  const { data: primaryEnsName } = useEnsName(primaryAddress);
  const navigate = useNavigate();
  const intl = useIntl();

  const handleLogout = async () => {
    hapticLight();
    try {
      await signOut();
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
            <div className="truncate text-label-md font-medium">
              {authMode === "passkey"
                ? intl.formatMessage({
                    id: "app.account.passkey",
                    defaultMessage: "Passkey",
                  })
                : intl.formatMessage({
                    id: "app.account.wallet",
                    defaultMessage: "Wallet",
                  })}
            </div>
            <div className="text-xs text-text-sub-600">
              {authMode === "passkey" && credential
                ? intl.formatMessage({ id: "app.account.statusActive", defaultMessage: "Active" })
                : (authMode === "wallet" && walletAddress) ||
                    (authMode === "embedded" && embeddedAddress)
                  ? intl.formatMessage({
                      id: "app.account.statusConnected",
                      defaultMessage: "Connected",
                    })
                  : intl.formatMessage({
                      id: "app.account.statusNotConfigured",
                      defaultMessage: "Not configured",
                    })}
            </div>
          </div>
        </div>
      </Card>

      {primaryAddress && (
        <Card>
          <div className="flex items-center gap-3 w-full">
            <Avatar>
              <div className="flex items-center justify-center text-center mx-auto text-primary">
                <RiUserLine className="w-4" />
              </div>
            </Avatar>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="truncate text-label-md font-medium">
                {intl.formatMessage({
                  id: "app.account.address",
                  defaultMessage: "Address",
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
              defaultMessage: "Save a backup before changing browsers",
            })}
          </p>
          <p className="mt-1 leading-relaxed">
            {intl.formatMessage({
              id: "app.identity.passkeyWarning.message",
              defaultMessage:
                "This sign-in lives on this device only. Clearing browser data or uninstalling the app will sign you out.",
            })}
          </p>
          <p className="mt-1 leading-relaxed">
            {intl.formatMessage({
              id: "app.identity.passkeyWarning.guidance",
              defaultMessage: "Want access from another device? Sign in with a wallet instead.",
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
