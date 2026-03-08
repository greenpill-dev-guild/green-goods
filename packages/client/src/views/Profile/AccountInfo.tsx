import {
  type Address,
  debugError,
  hapticLight,
  toastService,
  useAuth,
  useEnsName,
} from "@green-goods/shared";
import { RiKeyLine, RiLogoutBoxRLine, RiWalletLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Actions";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
import { AddressCopy } from "@/components/Inputs";

export const AccountInfo: React.FC = () => {
  const { authMode, signOut, smartAccountAddress, credential, walletAddress } = useAuth();
  const primaryAddress = smartAccountAddress || walletAddress;
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
                : authMode === "wallet" && walletAddress
                  ? "Connected"
                  : "Not configured"}
            </div>
          </div>
        </div>
      </Card>

      {(smartAccountAddress || walletAddress) && (
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
