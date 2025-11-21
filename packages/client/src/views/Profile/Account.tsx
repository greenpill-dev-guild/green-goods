import { toastService } from "@green-goods/shared";
import { useAuth, useAutoJoinRootGarden, useEnsName } from "@green-goods/shared/hooks";
import { type Locale, useApp } from "@green-goods/shared/providers/app";
import { capitalize } from "@green-goods/shared/utils";
import { parseAndFormatError } from "@green-goods/shared/utils/errors";
import {
  RiEarthFill,
  RiKeyLine,
  RiLogoutBoxRLine,
  RiPlantLine,
  RiWalletLine,
} from "@remixicon/react";
import { ReactNode } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@/components/UI/Avatar/Avatar";
import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card/Card";
import { AddressCopy } from "@/components/UI/Clipboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/UI/Select/Select";

interface ApplicationSettings {
  title: string;
  description: string;
  Option: () => ReactNode;
  Icon: React.ReactNode;
}

type ProfileAccountProps = {};

export const ProfileAccount: React.FC<ProfileAccountProps> = () => {
  const { authMode, signOut, disconnectWallet, smartAccountAddress, credential, walletAddress } =
    useAuth();
  const primaryAddress = smartAccountAddress || walletAddress;
  const { data: primaryEnsName } = useEnsName(primaryAddress);
  const navigate = useNavigate();
  const { locale, switchLanguage, availableLocales } = useApp();
  const intl = useIntl();

  // Check if DevConnect is enabled via environment variable
  const isDevConnectEnabled = import.meta.env.VITE_DEVCONNECT === "true";

  // Root garden membership check
  const {
    isGardener: isRootGardener,
    isLoading: isJoiningOrCheckingRootGarden,
    joinGarden,
    devConnect,
  } = useAutoJoinRootGarden();

  const handleJoinRootGarden = async () => {
    try {
      await joinGarden();

      toastService.success({
        title: intl.formatMessage({
          id: "app.account.joinedRootGarden",
          defaultMessage: "Joined Community Garden",
        }),
        message: intl.formatMessage({
          id: "app.account.joinedRootGardenMessage",
          defaultMessage: "Welcome to the community!",
        }),
        context: "joinRootGarden",
      });
    } catch (err) {
      console.error("Failed to join root garden", err);

      // Parse the error for user-friendly message
      const { title, message } = parseAndFormatError(err);

      toastService.error({
        title: title,
        message: message,
        context: "joinRootGarden",
        error: err,
      });
    }
  };

  const handleJoinDevConnect = async () => {
    try {
      await devConnect.join();
      toastService.success({ title: "Joined DevConnect", context: "account" });
    } catch (err) {
      toastService.error({ title: "Failed to join", error: err, context: "account" });
    }
  };

  const handleLogout = async () => {
    try {
      if (authMode === "passkey") {
        signOut();
      } else if (authMode === "wallet") {
        await disconnectWallet();
      } else {
        signOut();
      }

      navigate("/login");
      const message = intl.formatMessage({
        id: "app.toast.loggedOut",
        defaultMessage: "Logged out successfully",
      });
      toastService.success({
        title: intl.formatMessage({
          id: "app.account.sessionClosed",
          defaultMessage: "Signed out",
        }),
        message,
        context: "logout",
        suppressLogging: true,
      });
    } catch (err) {
      console.error("Logout failed", err);
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

  const applicationSettings: ApplicationSettings[] = [
    {
      title: intl.formatMessage({
        id: "app.settings.language",
        description: "Language",
      }),
      description: intl.formatMessage(
        {
          id: "app.settings.selectLanguage",
          description: "Select your desired language, language selector",
          defaultMessage: "Select your preferred language",
        },
        {
          language: locale,
        }
      ),
      Icon: <RiEarthFill className="w-4" />,
      Option: () => (
        <Select onValueChange={(val) => switchLanguage(val as Locale)}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue
              className="capitalize"
              placeholder={capitalize(intl.formatDisplayName(locale, { type: "language" }) || "")}
            />
          </SelectTrigger>
          <SelectContent>
            {availableLocales?.map((localeOption) => (
              <SelectItem value={localeOption} key={localeOption} className="capitalize">
                {capitalize(intl.formatDisplayName(localeOption, { type: "language" }) || "")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ];

  return (
    <>
      <h5 className="text-label-md text-slate-900">
        {intl.formatMessage({
          id: "app.profile.settings",
          description: "Settings",
        })}
      </h5>
      {applicationSettings.map(({ title, Icon, description, Option }) => (
        <Card key={title}>
          <div className="flex flex-row items-center gap-3 justify-center w-full">
            <Avatar>
              <div className="flex items-center justify-center text-center mx-auto text-primary">
                {Icon}
              </div>
            </Avatar>
            <div className="flex flex-col gap-1 grow">
              <div className="flex items-center font-sm gap-1">
                <div className="line-clamp-1 text-sm">{title}</div>
              </div>
              <div className="text-xs text-gray-500">{description}</div>
            </div>
            {<Option />}
          </div>
        </Card>
      ))}

      <h5 className="text-label-md text-slate-900">
        {intl.formatMessage({
          id: "app.profile.account",
          description: "Account",
        })}
      </h5>

      {/* Root Garden Membership Button */}
      {primaryAddress && (
        <div className="flex flex-col gap-3 w-full">
          <Button
            variant="primary"
            mode="filled"
            onClick={isRootGardener ? undefined : handleJoinRootGarden}
            label={
              isJoiningOrCheckingRootGarden
                ? intl.formatMessage({
                    id: "app.profile.joiningRootGarden",
                    defaultMessage: "Joining...",
                  })
                : isRootGardener
                  ? intl.formatMessage({
                      id: "app.profile.leaveRootGarden",
                      defaultMessage: "Leave Community Garden",
                    })
                  : intl.formatMessage({
                      id: "app.profile.joinRootGarden",
                      defaultMessage: "Join Community Garden",
                    })
            }
            leadingIcon={<RiPlantLine className="w-4" />}
            disabled={isJoiningOrCheckingRootGarden || isRootGardener}
            className="w-full"
          />

          {/* DevConnect Button */}
          {isDevConnectEnabled && devConnect.isEnabled && (
            <Button
              variant="primary"
              mode="filled"
              onClick={devConnect.isMember ? undefined : handleJoinDevConnect}
              label={devConnect.isMember ? "DevConnect Member" : "Join DevConnect"}
              leadingIcon={<RiPlantLine className="w-4" />}
              disabled={devConnect.isLoading || devConnect.isMember}
              className="w-full mt-2"
            />
          )}
        </div>
      )}

      {/* Auth Mode Info */}
      <Card>
        <div className="flex flex-row items-center gap-3 justify-center w-full">
          <Avatar>
            <div className="flex items-center justify-center text-center mx-auto text-primary">
              {authMode === "passkey" ? (
                <RiKeyLine className="w-4" />
              ) : (
                <RiWalletLine className="w-4" />
              )}
            </div>
          </Avatar>
          <div className="flex flex-col gap-1 grow">
            <div className="flex items-center font-sm gap-1">
              <div className="line-clamp-1 text-sm">
                {authMode === "passkey"
                  ? intl.formatMessage({
                      id: "app.account.passkey",
                      description: "Passkey Wallet",
                    })
                  : intl.formatMessage({
                      id: "app.account.wallet",
                      description: "External Wallet",
                    })}
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {authMode === "passkey" && credential
                ? "Active"
                : authMode === "wallet" && walletAddress
                  ? "Connected"
                  : "Not configured"}
            </div>
          </div>
        </div>
      </Card>

      {/* Address Display */}
      {(smartAccountAddress || walletAddress) && (
        <Card>
          <div className="flex flex-row items-center gap-3 justify-center w-full">
            <Avatar>
              <div className="flex items-center justify-center text-center mx-auto text-primary">
                <RiWalletLine className="w-4" />
              </div>
            </Avatar>
            <div className="flex flex-col gap-1 grow">
              <div className="flex items-center font-sm gap-1">
                <div className="line-clamp-1 text-sm">
                  {intl.formatMessage({
                    id: "app.account.address",
                    description:
                      authMode === "passkey" ? "Smart Account Address" : "Wallet Address",
                  })}
                </div>
              </div>
              <AddressCopy
                address={primaryAddress}
                ensName={primaryEnsName}
                size="compact"
                className="mt-2"
              />
            </div>
          </div>
        </Card>
      )}

      <Button
        variant="neutral"
        mode="stroke"
        onClick={handleLogout}
        label={intl.formatMessage({
          id: "app.profile.logout",
          description: "Logout",
        })}
        leadingIcon={<RiLogoutBoxRLine className="w-4" />}
        className="w-full"
      />
    </>
  );
};
