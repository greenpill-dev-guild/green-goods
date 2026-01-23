import {
  copyToClipboard,
  hapticLight,
  hapticSuccess,
  toastService,
  type Garden,
} from "@green-goods/shared";
import {
  isGardenMember,
  useAuth,
  useEnsName,
  useGardens,
  useInstallGuidance,
  useJoinGarden,
  useTheme,
} from "@green-goods/shared/hooks";
import { type Locale, useApp } from "@green-goods/shared/providers";
import { capitalize, isAlreadyGardenerError, parseAndFormatError } from "@green-goods/shared/utils";
import { debugError } from "@green-goods/shared/utils/debug";
import {
  RiAlertLine,
  RiCheckLine,
  RiComputerLine,
  RiDownloadLine,
  RiEarthFill,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiKeyLine,
  RiLogoutBoxRLine,
  RiMapPinLine,
  RiMoonLine,
  RiPlantLine,
  RiRefreshLine,
  RiSmartphoneLine,
  RiSunLine,
  RiWalletLine,
} from "@remixicon/react";
import { type ReactNode, useMemo } from "react";
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

export const ProfileAccount: React.FC = () => {
  const { authMode, signOut, smartAccountAddress, credential, walletAddress } = useAuth();
  const { theme, setTheme } = useTheme();
  const primaryAddress = smartAccountAddress || walletAddress;
  const { data: primaryEnsName } = useEnsName(primaryAddress);
  const navigate = useNavigate();
  const {
    locale,
    switchLanguage,
    availableLocales,
    isMobile,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    promptInstall,
    platform,
  } = useApp();
  const intl = useIntl();

  // Get browser-aware installation guidance
  const guidance = useInstallGuidance(
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    isMobile
  );

  // Memoize install description to avoid nested ternary in JSX
  const installDescription = useMemo(() => {
    if (guidance.scenario === "native-prompt-available") {
      return intl.formatMessage({
        id: "app.profile.installDescriptionPrompt",
        defaultMessage: "Install for the best experience with offline support.",
      });
    }
    if (guidance.manualInstructions) {
      return guidance.manualInstructions
        .map((step) => step.description.replace(/\*\*/g, ""))
        .join(" → ");
    }
    if (platform === "ios") {
      return intl.formatMessage({
        id: "app.profile.installDescriptionIOS",
        defaultMessage: "Tap Share → Add to Home Screen in Safari.",
      });
    }
    return intl.formatMessage({
      id: "app.profile.installDescriptionAndroid",
      defaultMessage: "Open in Chrome → Menu → Install app.",
    });
  }, [guidance.scenario, guidance.manualInstructions, platform, intl]);

  // Fetch all gardens (openJoining is now included from indexer)
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();

  // Join garden hook
  const { joinGarden, isJoining, joiningGardenId } = useJoinGarden();

  // Show only open gardens or gardens where user is a member
  // Uses garden.openJoining from indexer instead of per-garden RPC calls
  const allGardens = useMemo(() => {
    if (!primaryAddress || !gardens.length) return [];

    return gardens
      .filter((garden) => {
        // Use openJoining from indexer (defaults to false if missing)
        const isOpen = garden.openJoining === true;
        const isMember = isGardenMember(
          primaryAddress,
          garden.gardeners,
          garden.operators,
          garden.id
        );
        // Only show gardens that are open OR user is already a member
        return isOpen || isMember;
      })
      .map((garden) => ({
        ...garden,
        isMember: isGardenMember(primaryAddress, garden.gardeners, garden.operators, garden.id),
      }));
  }, [gardens, primaryAddress]);

  const handleJoinGarden = async (garden: Garden) => {
    // Provide haptic feedback when join button is pressed
    hapticLight();
    try {
      await joinGarden(garden.id);

      // Provide haptic feedback for successful join
      hapticSuccess();
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

      debugError(`Failed to join garden ${garden.id}`, err);

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
    // Provide haptic feedback when logout button is pressed
    hapticLight();
    try {
      await signOut?.();
      // Pass fromLogout state to prevent redirect back to profile
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

  /**
   * Force refresh the app by clearing caches and reloading.
   * Useful when users experience "weird behavior" after an update.
   */
  const handleRefreshApp = async () => {
    // Provide haptic feedback when refresh button is pressed
    hapticLight();
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toastService.info({
        title: intl.formatMessage({
          id: "app.update.offline",
          defaultMessage: "You're offline",
        }),
        message: intl.formatMessage({
          id: "app.update.offlineMessage",
          defaultMessage: "Connect to the internet to update the app.",
        }),
        context: "appRefresh",
      });
      return;
    }

    try {
      toastService.loading({
        title: intl.formatMessage({
          id: "app.update.refreshing",
          defaultMessage: "Updating app…",
        }),
        message: intl.formatMessage({
          id: "app.update.refreshingMessage",
          defaultMessage: "Clearing cached data and reloading.",
        }),
        context: "appRefresh",
      });

      // Unregister all service workers
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }

      // Clear all caches
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

      // Clear React Query persisted cache (localStorage + IndexedDB)
      try {
        localStorage.removeItem("__rq_pc__");
      } catch (e) {
        if (import.meta.env.DEV) console.debug("[AppRefresh] localStorage clear failed:", e);
      }
      try {
        indexedDB.deleteDatabase("gg-react-query");
      } catch (e) {
        if (import.meta.env.DEV) console.debug("[AppRefresh] IndexedDB clear failed:", e);
      }
    } catch (err) {
      console.debug("[AppRefresh] Best-effort cache clear failed:", err);
    } finally {
      window.location.reload();
    }
  };

  const themeOptions = useMemo(
    () => [
      {
        value: "light" as const,
        label: intl.formatMessage({ id: "app.settings.themeLight", defaultMessage: "Light" }),
        icon: <RiSunLine className="w-4" />,
      },
      {
        value: "dark" as const,
        label: intl.formatMessage({ id: "app.settings.themeDark", defaultMessage: "Dark" }),
        icon: <RiMoonLine className="w-4" />,
      },
      {
        value: "system" as const,
        label: intl.formatMessage({ id: "app.settings.themeSystem", defaultMessage: "System" }),
        icon: <RiComputerLine className="w-4" />,
      },
    ],
    [intl]
  );

  const currentThemeOption = themeOptions.find((opt) => opt.value === theme) || themeOptions[2];

  const applicationSettings: ApplicationSettings[] = useMemo(
    () => [
      {
        title: intl.formatMessage({
          id: "app.settings.theme",
          defaultMessage: "Theme",
        }),
        description: intl.formatMessage({
          id: "app.settings.selectTheme",
          defaultMessage: "Choose your preferred appearance",
        }),
        Icon: currentThemeOption.icon,
        Option: () => (
          <Select
            value={theme}
            onValueChange={(val) => setTheme(val as "light" | "dark" | "system")}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={currentThemeOption.label} />
            </SelectTrigger>
            <SelectContent>
              {themeOptions.map((opt) => (
                <SelectItem value={opt.value} key={opt.value}>
                  <span className="flex items-center gap-2">
                    {opt.icon}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        title: intl.formatMessage({
          id: "app.settings.language",
          defaultMessage: "Language",
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
            <SelectTrigger className="w-full sm:w-[180px]">
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
    ],
    [
      intl,
      theme,
      setTheme,
      currentThemeOption,
      themeOptions,
      locale,
      switchLanguage,
      availableLocales,
    ]
  );

  return (
    <>
      {/* Install CTA (mobile web only, not yet installed) */}
      {isMobile && !isInstalled && (
        <>
          <h5 className="text-label-md text-text-strong-950">
            {intl.formatMessage({
              id: "app.profile.install",
              defaultMessage: "Install App",
            })}
          </h5>

          {/* Browser switch warning when in wrong browser or in-app browser */}
          {(guidance.scenario === "wrong-browser" || guidance.scenario === "in-app-browser") && (
            <Card>
              <div className="flex flex-row items-start gap-3 w-full">
                <Avatar>
                  <div className="flex items-center justify-center text-center mx-auto text-warning-dark">
                    <RiAlertLine className="w-4" />
                  </div>
                </Avatar>
                <div className="flex flex-col gap-1 grow">
                  <div className="text-sm font-medium text-warning-dark">
                    {guidance.scenario === "in-app-browser"
                      ? intl.formatMessage({
                          id: "app.profile.openInBrowser",
                          defaultMessage: "Open in Browser",
                        })
                      : intl.formatMessage({
                          id: "app.profile.switchBrowser",
                          defaultMessage: "Switch Browser",
                        })}
                  </div>
                  <div className="text-xs text-text-sub-600">{guidance.browserSwitchReason}</div>
                </div>
                {guidance.openInBrowserUrl ? (
                  <Button
                    variant="primary"
                    mode="filled"
                    size="xsmall"
                    onClick={() => {
                      hapticLight();
                      window.location.href = guidance.openInBrowserUrl as string;
                    }}
                    leadingIcon={<RiExternalLinkLine className="w-4" />}
                    label={intl.formatMessage({
                      id: "app.profile.openChrome",
                      defaultMessage: "Open in Chrome",
                    })}
                    className="shrink-0"
                  />
                ) : (
                  <Button
                    variant="primary"
                    mode="filled"
                    size="xsmall"
                    onClick={async () => {
                      hapticLight();
                      const success = await copyToClipboard(window.location.href);
                      if (success) {
                        toastService.success({
                          title: intl.formatMessage({
                            id: "app.profile.urlCopied",
                            defaultMessage: "Link Copied",
                          }),
                          message: intl.formatMessage({
                            id: "app.profile.urlCopiedMessage",
                            defaultMessage: "Open Safari and paste the link to install.",
                          }),
                          context: "copy-url",
                          suppressLogging: true,
                        });
                      }
                    }}
                    leadingIcon={<RiFileCopyLine className="w-4" />}
                    label={intl.formatMessage({
                      id: "app.profile.copyLink",
                      defaultMessage: "Copy Link",
                    })}
                    className="shrink-0"
                  />
                )}
              </div>
            </Card>
          )}

          {/* Main install card - only show when in correct browser */}
          {guidance.scenario !== "wrong-browser" && guidance.scenario !== "in-app-browser" && (
            <Card>
              <div className="flex flex-row items-center gap-3 justify-between w-full">
                <Avatar>
                  <div className="flex items-center justify-center text-center mx-auto text-primary">
                    <RiSmartphoneLine className="w-4" />
                  </div>
                </Avatar>
                <div className="flex flex-col gap-1 grow">
                  <div className="text-sm font-medium">
                    {intl.formatMessage({
                      id: "app.profile.installTitle",
                      defaultMessage: "Install Green Goods",
                    })}
                  </div>
                  <div className="text-xs text-text-sub-600">{installDescription}</div>
                </div>
                {guidance.scenario === "native-prompt-available" && (
                  <Button
                    variant="primary"
                    mode="filled"
                    size="xsmall"
                    onClick={promptInstall}
                    leadingIcon={<RiDownloadLine className="w-4" />}
                    label={intl.formatMessage({
                      id: "app.profile.installButton",
                      defaultMessage: "Install",
                    })}
                    className="shrink-0"
                  />
                )}
              </div>
            </Card>
          )}
        </>
      )}

      <h5 className="text-label-md text-text-strong-950">
        {intl.formatMessage({
          id: "app.profile.settings",
          defaultMessage: "Settings",
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
              <div className="text-xs text-text-sub-600">{description}</div>
            </div>
            <Option />
          </div>
        </Card>
      ))}

      {/* Refresh App - Clear caches and reload for updates */}
      <Card>
        <div className="flex flex-row items-center gap-3 justify-between w-full">
          <Avatar>
            <div className="flex items-center justify-center text-center mx-auto text-primary">
              <RiRefreshLine className="w-4" />
            </div>
          </Avatar>
          <div className="flex flex-col gap-1 grow">
            <div className="line-clamp-1 text-sm">
              {intl.formatMessage({
                id: "app.update.title",
                defaultMessage: "Refresh app",
              })}
            </div>
            <div className="text-xs text-text-sub-600">
              {intl.formatMessage({
                id: "app.update.subtitle",
                defaultMessage: "Use this if things look weird after an update.",
              })}
            </div>
          </div>
          <Button
            variant="neutral"
            mode="stroke"
            size="xsmall"
            onClick={handleRefreshApp}
            leadingIcon={<RiRefreshLine className="w-4" />}
            label={intl.formatMessage({
              id: "app.update.button",
              defaultMessage: "Refresh",
            })}
            className="shrink-0"
          />
        </div>
      </Card>

      {/* Gardens Section - All available gardens with membership status */}
      {primaryAddress && (
        <>
          <h5 className="text-label-md text-text-strong-950">
            {intl.formatMessage({
              id: "app.profile.gardens",
              defaultMessage: "Gardens",
            })}
          </h5>

          {gardensLoading ? (
            <Card>
              <div className="flex flex-row items-center justify-center w-full py-2">
                <span className="text-sm text-text-sub-600">
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
                            <div className="flex items-center gap-1 text-xs text-text-sub-600">
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
              <div className="flex flex-col items-center gap-3 w-full py-4">
                <RiPlantLine className="w-8 h-8 text-text-soft-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-text-strong-950">
                    {intl.formatMessage({
                      id: "app.profile.noGardensTitle",
                      defaultMessage: "No gardens yet",
                    })}
                  </p>
                  <p className="text-xs text-text-sub-600 mt-1">
                    {intl.formatMessage({
                      id: "app.profile.noGardensDescription",
                      defaultMessage: "Discover and join gardens to start submitting work",
                    })}
                  </p>
                </div>
                <Button
                  variant="primary"
                  mode="filled"
                  size="xsmall"
                  onClick={() => navigate("/home")}
                  leadingIcon={<RiPlantLine className="w-4" />}
                  label={intl.formatMessage({
                    id: "app.profile.discoverGardens",
                    defaultMessage: "Discover Gardens",
                  })}
                />
              </div>
            </Card>
          )}
        </>
      )}

      <h5 className="text-label-md text-text-strong-950">
        {intl.formatMessage({
          id: "app.profile.account",
          defaultMessage: "Account",
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
                      defaultMessage: "Passkey Wallet",
                    })
                  : intl.formatMessage({
                      id: "app.account.wallet",
                      defaultMessage: "External Wallet",
                    })}
              </div>
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
                    defaultMessage:
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
          defaultMessage: "Logout",
        })}
        leadingIcon={<RiLogoutBoxRLine className="w-4" />}
        className="w-full"
      />
    </>
  );
};
