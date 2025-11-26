import { toastService } from "@green-goods/shared";
import {
  checkGardenOpenJoining,
  isGardenMember,
  useAutoJoinRootGarden,
  useEnsName,
  useGardens,
  useJoinGarden,
} from "@green-goods/shared/hooks";
import { useClientAuth } from "@green-goods/shared/providers";
import { type Locale, useApp } from "@green-goods/shared/providers/app";
import { capitalize, parseAndFormatError } from "@green-goods/shared/utils";
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
  const { authMode, signOut, smartAccountAddress, credential, walletAddress } = useClientAuth();
  const primaryAddress = smartAccountAddress || walletAddress;
  const { data: primaryEnsName } = useEnsName(primaryAddress);
  const navigate = useNavigate();
  const { locale, switchLanguage, availableLocales } = useApp();
  const intl = useIntl();

  // Check if DevConnect is enabled via environment variable
  const isDevConnectEnabled = import.meta.env.VITE_DEVCONNECT === "true";

  // Fetch all gardens
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();

  // Join garden hook
  const { joinGarden, isJoining, joiningGardenId } = useJoinGarden();

  // Root garden membership check (for DevConnect and legacy support)
  const { devConnect } = useAutoJoinRootGarden();

  // Track which gardens have openJoining enabled
  const [openGardensMap, setOpenGardensMap] = useState<Map<string, boolean>>(new Map());
  const [checkingOpenJoining, setCheckingOpenJoining] = useState(false);

  // Filter gardens into member and non-member lists
  const { memberGardens, nonMemberGardens } = useMemo(() => {
    if (!primaryAddress || !gardens.length) {
      return { memberGardens: [], nonMemberGardens: [] };
    }

    const members: Garden[] = [];
    const nonMembers: Garden[] = [];

    for (const garden of gardens) {
      if (isGardenMember(primaryAddress, garden.gardeners, garden.operators)) {
        members.push(garden);
      } else {
        nonMembers.push(garden);
      }
    }

    return { memberGardens: members, nonMemberGardens: nonMembers };
  }, [gardens, primaryAddress]);

  // Check openJoining status for non-member gardens
  useEffect(() => {
    const checkOpenJoiningStatus = async () => {
      if (nonMemberGardens.length === 0) return;

      setCheckingOpenJoining(true);
      const results = new Map<string, boolean>();

      // Check all non-member gardens in parallel
      await Promise.all(
        nonMemberGardens.map(async (garden) => {
          const isOpen = await checkGardenOpenJoining(garden.id);
          results.set(garden.id, isOpen);
        })
      );

      setOpenGardensMap(results);
      setCheckingOpenJoining(false);
    };

    checkOpenJoiningStatus();
  }, [nonMemberGardens]);

  // Filter to only show gardens with openJoining = true
  const joinableGardens = useMemo(() => {
    return nonMemberGardens.filter((garden) => openGardensMap.get(garden.id) === true);
  }, [nonMemberGardens, openGardensMap]);

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
      await signOut();
      navigate("/login", { replace: true });
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

      {/* Gardens Section */}
      {primaryAddress && (
        <>
          {/* My Gardens - Member gardens */}
          {memberGardens.length > 0 && (
            <>
              <h5 className="text-label-md text-slate-900">
                {intl.formatMessage({
                  id: "app.profile.myGardens",
                  defaultMessage: "My Gardens",
                })}
              </h5>
              <div className="flex flex-col gap-2">
                {memberGardens.map((garden) => (
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
                      <div className="flex items-center gap-1 text-xs text-primary shrink-0">
                        <RiCheckLine className="w-4 h-4" />
                        <span>
                          {intl.formatMessage({
                            id: "app.profile.member",
                            defaultMessage: "Member",
                          })}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Available Gardens - Joinable gardens with openJoining = true */}
          <h5 className="text-label-md text-slate-900">
            {intl.formatMessage({
              id: "app.profile.availableGardens",
              defaultMessage: "Available Gardens",
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
          ) : joinableGardens.length > 0 ? (
            <div className="flex flex-col gap-2">
              {joinableGardens.map((garden) => {
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
                      <Button
                        variant="primary"
                        mode="filled"
                        size="xsmall"
                        onClick={() => handleJoinGarden(garden)}
                        label={
                          isJoiningThis
                            ? intl.formatMessage({
                                id: "app.profile.joining",
                                defaultMessage: "Joining...",
                              })
                            : intl.formatMessage({
                                id: "app.profile.join",
                                defaultMessage: "Join",
                              })
                        }
                        disabled={isJoining}
                        className="shrink-0"
                      />
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
                    id: "app.profile.noJoinableGardens",
                    defaultMessage: "No open gardens available to join",
                  })}
                </span>
              </div>
            </Card>
          )}

          {/* DevConnect Button - Optional */}
          {isDevConnectEnabled && devConnect.isEnabled && !devConnect.isMember && (
            <Button
              variant="primary"
              mode="filled"
              onClick={handleJoinDevConnect}
              label={devConnect.isLoading ? "Joining..." : "Join DevConnect"}
              leadingIcon={<RiPlantLine className="w-4" />}
              disabled={devConnect.isLoading}
              className="w-full"
            />
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
