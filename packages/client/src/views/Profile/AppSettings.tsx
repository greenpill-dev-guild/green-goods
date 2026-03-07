import {
  capitalize,
  hapticLight,
  logger,
  toastService,
  useApp,
  useServiceWorkerUpdate,
  useTheme,
  type Locale,
} from "@green-goods/shared";
import {
  RiComputerLine,
  RiEarthFill,
  RiMoonLine,
  RiRefreshLine,
  RiSunLine,
} from "@remixicon/react";
import { type ReactNode, useMemo } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Inputs";

interface ApplicationSettings {
  title: string;
  description: string;
  Option: () => ReactNode;
  Icon: React.ReactNode;
}

export const AppSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { locale, switchLanguage, availableLocales } = useApp();
  const { updateAvailable, isUpdating, waitingWorker, applyUpdate, checkForUpdate } =
    useServiceWorkerUpdate();
  const intl = useIntl();

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
            <SelectTrigger size="sm" className="w-full sm:w-[180px]">
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
            <SelectTrigger size="sm" className="w-full sm:w-[180px]">
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

  const handleRefreshApp = async () => {
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
      const hasWaitingWorker = Boolean(updateAvailable || waitingWorker);

      toastService.loading({
        title: intl.formatMessage({
          id: hasWaitingWorker ? "app.update.refreshing" : "app.update.checking",
          defaultMessage: hasWaitingWorker ? "Updating app…" : "Checking for updates…",
        }),
        message: intl.formatMessage({
          id: hasWaitingWorker ? "app.update.refreshingMessage" : "app.update.checkingMessage",
          defaultMessage: hasWaitingWorker
            ? "Activating the new version and reloading."
            : "Looking for the latest version of the app.",
        }),
        context: "appRefresh",
      });

      if (hasWaitingWorker) {
        applyUpdate();
        return;
      }

      const updateReady = await checkForUpdate();
      if (updateReady) {
        toastService.loading({
          title: intl.formatMessage({
            id: "app.update.refreshing",
            defaultMessage: "Updating app…",
          }),
          message: intl.formatMessage({
            id: "app.update.refreshingMessage",
            defaultMessage: "Activating the new version and reloading.",
          }),
          context: "appRefresh",
        });
        applyUpdate();
        return;
      }

      toastService.info({
        title: intl.formatMessage({
          id: "app.update.current",
          defaultMessage: "You're up to date",
        }),
        message: intl.formatMessage({
          id: "app.update.currentMessage",
          defaultMessage: "No new version is ready to install right now.",
        }),
        context: "appRefresh",
      });
    } catch (error) {
      logger.debug("[AppUpdate] Update check failed:", { error });
      toastService.error({
        title: intl.formatMessage({
          id: "app.update.failed",
          defaultMessage: "Update check failed",
        }),
        message: intl.formatMessage({
          id: "app.update.failedMessage",
          defaultMessage: "Please try again in a moment.",
        }),
        context: "appRefresh",
        error,
      });
    }
  };

  return (
    <>
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
              <div className="flex items-center gap-1">
                <div className="line-clamp-1 text-label-sm text-text-strong-950">{title}</div>
              </div>
              <div className="text-paragraph-xs text-text-sub-600">{description}</div>
            </div>
            <Option />
          </div>
        </Card>
      ))}

      <Card>
        <div className="flex flex-row items-center gap-3 justify-between w-full">
          <Avatar>
            <div className="flex items-center justify-center text-center mx-auto text-primary">
              <RiRefreshLine className="w-4" />
            </div>
          </Avatar>
          <div className="flex flex-col gap-1 grow">
            <div className="line-clamp-1 text-label-sm text-text-strong-950">
              {intl.formatMessage({
                id: "app.update.title",
                defaultMessage: "Update app",
              })}
            </div>
            <div className="text-paragraph-xs text-text-sub-600">
              {intl.formatMessage({
                id: "app.update.subtitle",
                defaultMessage: "Check for a new version and install it when it is ready.",
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
              defaultMessage: "Update",
            })}
            disabled={isUpdating}
            className="shrink-0"
          />
        </div>
      </Card>
    </>
  );
};
