import {
  capitalize,
  hapticLight,
  type Locale,
  logger,
  toastService,
  useApp,
  useTheme,
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

      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

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
      logger.debug("[AppRefresh] Best-effort cache clear failed:", { error: err });
    } finally {
      window.location.reload();
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
              <div className="flex items-center font-sm gap-1">
                <div className="line-clamp-1 text-sm">{title}</div>
              </div>
              <div className="text-xs text-text-sub-600">{description}</div>
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
    </>
  );
};
