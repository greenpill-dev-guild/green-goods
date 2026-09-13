import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { isPasskeyServerEnabled } from "@green-goods/shared/config/passkeyServer";
import { useAuthActions, useAuthState } from "@green-goods/shared/hooks/auth/useAuth";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import type { Address } from "@green-goods/shared/types/domain";
import { hapticLight } from "@green-goods/shared/utils/app/haptics";
import { debugError } from "@green-goods/shared/utils/debug";
import { RiKeyLine, RiLogoutBoxRLine, RiUserLine, RiWalletLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Actions";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
import { AddressCopy } from "@/components/Inputs";
import { APP_ROUTES } from "@/config/pwaRouting";

export const AccountInfo: React.FC = () => {
  const { authMode, credential, walletAddress, embeddedAddress, userName } = useAuthState();
  // The recovery line names a button the sign-in screen only renders with the
  // passkey server on; without it there is no username lookup to point at.
  const passkeyServerEnabled = isPasskeyServerEnabled();
  const { signOut } = useAuthActions();
  const primaryAddress = usePrimaryAddress();
  const { data: primaryEnsName } = useEnsName(primaryAddress);
  const navigate = useNavigate();
  const intl = useIntl();

  const handleLogout = async () => {
    hapticLight();
    try {
      await signOut();
      navigate(APP_ROUTES.login, {
        replace: true,
        state: { fromLogout: true },
        viewTransition: true,
      });
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

      {authMode === "passkey" && passkeyServerEnabled && (
        <div className="space-y-1 px-1 text-xs leading-relaxed text-text-sub-600">
          <p>
            {userName
              ? intl.formatMessage(
                  {
                    id: "app.identity.passkeyRecovery.device",
                    defaultMessage:
                      "To sign in on another device, choose “Already have an account?” and enter {name}.",
                  },
                  { name: userName }
                )
              : intl.formatMessage({
                  id: "app.identity.passkeyRecovery.deviceGeneric",
                  defaultMessage:
                    "To sign in on another device, choose “Already have an account?” and enter your username.",
                })}
          </p>
          <p>
            {intl.formatMessage({
              id: "app.identity.passkeyRecovery.account",
              defaultMessage:
                "Your passkey is saved in your Apple or Google account, so that device needs to be signed in to the same account.",
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
