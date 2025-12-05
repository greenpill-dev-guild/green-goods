import { toastService } from "@green-goods/shared";
import {
  checkGardenOpenJoining,
  isGardenMember,
  useClientAuth,
  useEnsName,
  useGardens,
  useJoinGarden,
} from "@green-goods/shared/hooks";
import { type Locale, useApp } from "@green-goods/shared/providers";
import { capitalize, isAlreadyGardenerError, parseAndFormatError } from "@green-goods/shared/utils";
import {
  RiCheckLine,
  RiEarthFill,
  RiKeyLine,
  RiLogoutBoxRLine,
  RiMapPinLine,
  RiPlantLine,
  RiWalletLine,
} from "@remixicon/react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Actions";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
import {
  AddressCopy,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Inputs";

interface ApplicationSettings {
  title: string;
  description: string;
  Option: () => ReactNode;
  Icon: React.ReactNode;
}

type ProfileAccountProps = {};

export const ProfileAccount: React.FC<ProfileAccountProps> = () => {
  const { authMode, signOut, smartAccountAddress, credential, walletAddress } = useClientAuth();
  const primaryAddress = smartAccountAddress || walletAddress;
  const { data: primaryEnsName } = useEnsName(primaryAddress);
  const navigate = useNavigate();
  const { locale, switchLanguage, availableLocales } = useApp();
  const intl = useIntl();

  // Fetch all gardens
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();

  // Join garden hook
  const { joinGarden, isJoining, joiningGardenId } = useJoinGarden();

  // Track which gardens have openJoining enabled (for join button state)
  const [openGardensMap, setOpenGardensMap] = useState<Map<string, boolean>>(new Map());
  const [checkingOpenJoining, setCheckingOpenJoining] = useState(false);

  // Check openJoining status for all gardens
  useEffect(() => {
    const checkOpenJoiningStatus = async () => {
      if (gardens.length === 0) return;

      setCheckingOpenJoining(true);
      const results = new Map<string, boolean>();

      // Check all gardens in parallel
      await Promise.all(
        gardens.map(async (garden) => {
          const isOpen = await checkGardenOpenJoining(garden.id);
          results.set(garden.id, isOpen);
        })
      );

      setOpenGardensMap(results);
      setCheckingOpenJoining(false);
    };

    checkOpenJoiningStatus();
  }, [gardens]);

  // Show only open gardens or gardens where user is a member
  const allGardens = useMemo(() => {
    if (!primaryAddress || !gardens.length) return [];

    return gardens
      .filter((garden) => {
        const isOpen = openGardensMap.get(garden.id) === true;
        const isMember = isGardenMember(primaryAddress, garden.gardeners, garden.operators);
        // Only show gardens that are open OR user is already a member
        return isOpen || isMember;
      })
      .map((garden) => ({
        ...garden,
        isMember: isGardenMember(primaryAddress, garden.gardeners, garden.operators),
      }));
  }, [gardens, primaryAddress, openGardensMap]);

  const handleJoinGarden = async (garden: Garden) => {
    try {
      await joinGarden(garden.id);

      toastService.success({
        title: intl.formatMessage(
          {
            id: "app.account.joinedGarden",
            defaultMessage: "Joined {gardenName}",
          },
          { gardenName: garden.name }
        ),
        message: intl.formatMessage({
          id: "app.account.joinedGardenMessage",
          defaultMessage: "Welcome to the garden!",
        }),
        context: "joinGarden",
      });
    } catch (err) {
      // Handle "already a member" as success, not error
      if (isAlreadyGardenerError(err)) {
        toastService.success({
          title: intl.formatMessage({
            id: "app.account.alreadyMember",
            defaultMessage: "Already a member",
          }),
          message: intl.formatMessage(
            {
              id: "app.account.alreadyMemberMessage",
              defaultMessage: "You're already a member of {gardenName}",
            },
            { gardenName: garden.name }
          ),
          context: "joinGarden",
        });
        return;
      }

      console.error(`Failed to join garden ${garden.id}`, err);

      const { title, message } = parseAndFormatError(err);

      toastService.error({
        title,
        message,
        context: "joinGarden",
        error: err,
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      // Pass fromLogout state to prevent redirect back to profile
      navigate("/login", { replace: true, state: { fromLogout: true } });
      toastService.success({
        title: intl.formatMessage({
          id: "app.account.sessionClosed",
          defaultMessage: "Signed out",
        }),
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
            {availableLocales?.map((localeOption: Locale) => (
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

      {/* Gardens Section - All available gardens with membership status */}
      {primaryAddress && (
        <>
          <h5 className="text-label-md text-slate-900">
            {intl.formatMessage({
              id: "app.profile.gardens",
              defaultMessage: "Gardens",
            })}
          </h5>

          {gardensLoading || checkingOpenJoining ? (
            <Card>
              <div className="flex flex-row items-center justify-center w-full py-2">
                <span className="text-sm text-slate-500">
                  {intl.formatMessage({
                    id: "app.profile.loadingGardens",
                    defaultMessage: "Loading gardens...",
                  })}
                </span>
              </div>
            </Card>
          ) : allGardens.length > 0 ? (
            <div className="flex flex-col gap-2">
              {allGardens.map((garden) => {
                const isJoiningThis = isJoining && joiningGardenId === garden.id;

                return (
                  <Card key={garden.id}>
                    <div className="flex flex-row items-center gap-3 justify-between w-full">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar>
                          <div className="flex items-center justify-center text-center mx-auto text-primary">
                            <RiPlantLine className="w-4" />
                          </div>
                        </Avatar>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="text-sm font-medium line-clamp-1">{garden.name}</div>
                          {garden.location && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <RiMapPinLine className="w-3 h-3 shrink-0" />
                              <span className="line-clamp-1">{garden.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {garden.isMember ? (
                        <div className="flex items-center gap-1 text-xs text-primary shrink-0">
                          <RiCheckLine className="w-4 h-4" />
                          <span>
                            {intl.formatMessage({
                              id: "app.profile.member",
                              defaultMessage: "Member",
                            })}
                          </span>
                        </div>
                      ) : (
                        <Button
                          variant="primary"
                          mode="filled"
                          size="xsmall"
                          onClick={() => handleJoinGarden(garden)}
                          label={intl.formatMessage({
                            id: "app.profile.join",
                            defaultMessage: "Join",
                          })}
                          disabled={isJoiningThis}
                          className="shrink-0"
                        />
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <div className="flex flex-row items-center gap-3 justify-center w-full py-2">
                <RiPlantLine className="w-5 text-slate-400" />
                <span className="text-sm text-slate-500">
                  {intl.formatMessage({
                    id: "app.profile.noGardens",
                    defaultMessage: "No gardens available",
                  })}
                </span>
              </div>
            </Card>
          )}
        </>
      )}

      <h5 className="text-label-md text-slate-900">
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
