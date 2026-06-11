import {
  capitalize,
  hapticLight,
  type Locale,
  useApp,
  useServiceWorkerUpdate,
  useTheme,
} from "@green-goods/shared";
import { RiEarthFill, RiRefreshLine, RiSettings2Line } from "@remixicon/react";
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
  const { updateAvailable, isUpdating, applyTimedOut, applyUpdate } = useServiceWorkerUpdate();
  const intl = useIntl();

  const themeOptions = useMemo(
    () => [
      {
        value: "light" as const,
        label: intl.formatMessage({ id: "app.settings.themeLight", defaultMessage: "Light" }),
      },
      {
        value: "dark" as const,
        label: intl.formatMessage({ id: "app.settings.themeDark", defaultMessage: "Dark" }),
      },
      {
        value: "system" as const,
        label: intl.formatMessage({ id: "app.settings.themeSystem", defaultMessage: "System" }),
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
          defaultMessage: "Choose how the app looks",
        }),
        Icon: <RiSettings2Line className="w-4" />,
        Option: () => (
          <Select
            value={theme}
            onValueChange={(val) => setTheme(val as "light" | "dark" | "system")}
          >
            <SelectTrigger size="sm" className="w-[110px] sm:w-[140px]">
              <SelectValue placeholder={currentThemeOption.label} />
            </SelectTrigger>
            <SelectContent>
              {themeOptions.map((opt) => (
                <SelectItem value={opt.value} key={opt.value}>
                  {opt.label}
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
            description: "Language preference subtitle",
            defaultMessage: "Set your preferred language",
          },
          {
            language: locale,
          }
        ),
        Icon: <RiEarthFill className="w-4" />,
        Option: () => (
          <Select onValueChange={(val) => switchLanguage(val as Locale)}>
            <SelectTrigger size="sm" className="w-[110px] sm:w-[140px]">
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

  const handleUpdateClick = () => {
    hapticLight();
    applyUpdate();
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
          <div className="flex flex-row items-center gap-3 w-full">
            <Avatar>
              <div className="flex items-center justify-center text-center mx-auto text-primary">
                {Icon}
              </div>
            </Avatar>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{title}</div>
              <div className="text-xs text-text-sub-600 line-clamp-2">{description}</div>
            </div>
            <div className="shrink-0">
              <Option />
            </div>
          </div>
        </Card>
      ))}

      {updateAvailable && (
        <Card>
          <div className="flex flex-row items-center gap-3 w-full">
            <Avatar>
              <div className="flex items-center justify-center text-center mx-auto text-primary">
                <RiRefreshLine className="w-4" />
              </div>
            </Avatar>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="text-sm font-medium">
                {intl.formatMessage({
                  id: "app.update.title",
                  defaultMessage: "Update app",
                })}
              </div>
              <div className="text-xs text-text-sub-600 line-clamp-2">
                {intl.formatMessage({
                  id: "app.update.subtitle",
                  defaultMessage: "A new version is ready.",
                })}
              </div>
              {applyTimedOut && !isUpdating && (
                <div role="status" className="text-xs text-error-dark">
                  {intl.formatMessage({
                    id: "app.update.timeout",
                    defaultMessage: "The update didn't finish. Close all app tabs and try again.",
                  })}
                </div>
              )}
            </div>
            <Button
              variant="neutral"
              mode="stroke"
              size="small"
              onClick={handleUpdateClick}
              disabled={isUpdating}
              label={intl.formatMessage({
                id: "app.update.button",
                defaultMessage: "Update",
              })}
              className="w-[110px] shrink-0 sm:w-[140px]"
            />
          </div>
        </Card>
      )}
    </>
  );
};
