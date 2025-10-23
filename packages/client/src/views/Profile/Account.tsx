import { RiEarthFill, RiKeyLine, RiLogoutBoxRLine, RiWalletLine } from "@remixicon/react";
import { ReactNode } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@/components/UI/Avatar/Avatar";
import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/UI/Select/Select";
import { useAuth, useEnsName } from "@green-goods/shared/hooks";
import { type Locale, useApp } from "@green-goods/shared/providers/app";
import { AddressCopy } from "@/components/UI/Clipboard";
import { capitalize } from "@green-goods/shared/utils";
import { toastService } from "@green-goods/shared";

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
          <SelectTrigger className="w-[180px]">
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
      <h5>
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

      <h5>
        {intl.formatMessage({
          id: "app.profile.account",
          description: "Account",
        })}
      </h5>

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

      {/* <h5>
        {intl.formatMessage({
          id: "app.profile.editAccount",
          description: "Edit Account",
        })}
      </h5> */}
      {/* <Card>
        <div className="flex flex-col gap-3">
          <FormInput
            id="display-name"
            label={intl.formatMessage({
              id: "app.profile.displayName",
              defaultMessage: "Display name",
            })}
            value={displayName}
            onChange={(e) => setDisplayName(e.currentTarget.value)}
            placeholder={intl.formatMessage({
              id: "app.profile.displayName.placeholder",
              defaultMessage: "e.g. Maria",
            })}
            className="mt-1"
          />
          <div className="flex justify-end">
            <Button
              variant="primary"
              mode="filled"
              size="xxsmall"
              label={
                saving
                  ? intl.formatMessage({ id: "app.common.saving", defaultMessage: "Saving..." })
                  : intl.formatMessage({ id: "app.common.save", defaultMessage: "Save" })
              }
              onClick={handleSave}
              disabled={saving || !displayName?.trim()}
            />
          </div>
        </div>
      </Card> */}

      <Button
        variant="neutral"
        mode="stroke"
        onClick={handleLogout}
        label={intl.formatMessage({
          id: "app.profile.logout",
          description: "Logout",
        })}
        leadingIcon={<RiLogoutBoxRLine className="w-4" />}
      />
    </>
  );
};
