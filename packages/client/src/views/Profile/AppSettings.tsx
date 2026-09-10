import { capitalize } from "@green-goods/shared/utils/app/text";
import { hapticLight } from "@green-goods/shared/utils/app/haptics";
import { type Locale, useApp } from "@green-goods/shared/providers/App";
import { useServiceWorkerUpdate } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import { useTheme } from "@green-goods/shared/hooks/app/useTheme";
import { RiEarthFill, RiRefreshLine, RiSettings2Line } from "@remixicon/react";
import { type ReactNode, useMemo, useState } from "react";
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

/** What the last manual check reported once the worker settled back to idle. */
type ManualCheckOutcome = "up-to-date" | "failed";

interface UpdateRow {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export const AppSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { locale, switchLanguage, availableLocales } = useApp();
  const { phase, checkForUpdate, activateNow } = useServiceWorkerUpdate();
  const [manualCheck, setManualCheck] = useState<ManualCheckOutcome | null>(null);
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

  const handleCheckClick = () => {
    hapticLight();
    setManualCheck(null);
    // Only ask the registration to look for a newer worker and report back.
    // Nothing on this path unregisters the worker or clears a cache; that is
    // what stranded installed users on the app-files screen before.
    void checkForUpdate().then(
      (found) => {
        if (!found) setManualCheck("up-to-date");
      },
      () => setManualCheck("failed")
    );
  };

  const handleApplyClick = () => {
    hapticLight();
    activateNow();
  };

  const checkLabel = intl.formatMessage({ id: "app.update.checkButton", defaultMessage: "Check" });
  const retryLabel = intl.formatMessage({
    id: "app.update.retryButton",
    defaultMessage: "Try Again",
  });

  const resolveUpdateRow = (): UpdateRow => {
    switch (phase) {
      case "checking":
        return {
          title: intl.formatMessage({
            id: "app.update.checking.title",
            defaultMessage: "Checking for update",
          }),
          description: intl.formatMessage({
            id: "app.update.checking.description",
            defaultMessage: "Looking for a newer version.",
          }),
        };
      case "downloading":
        return {
          title: intl.formatMessage({
            id: "app.update.downloading.title",
            defaultMessage: "Downloading update",
          }),
          description: intl.formatMessage({
            id: "app.update.downloading.description",
            defaultMessage: "Getting the latest version in the background.",
          }),
        };
      case "waiting":
        return {
          title: intl.formatMessage({
            id: "app.update.ready.title",
            defaultMessage: "Ready to restart",
          }),
          description: intl.formatMessage({
            id: "app.update.ready.description",
            defaultMessage: "Restart Green Goods to finish updating.",
          }),
          action: {
            label: intl.formatMessage({
              id: "app.update.restartButton",
              defaultMessage: "Restart to Update",
            }),
            onClick: handleApplyClick,
          },
        };
      case "activating":
        return {
          title: intl.formatMessage({
            id: "app.update.applying.title",
            defaultMessage: "Finishing update",
          }),
          description: intl.formatMessage({
            id: "app.update.applying.description",
            defaultMessage: "Restarting with the latest version.",
          }),
        };
      case "error":
        return {
          title: intl.formatMessage({
            id: "app.update.stalled.title",
            defaultMessage: "Update needs a restart",
          }),
          description: intl.formatMessage({
            id: "app.update.stalled.description",
            defaultMessage: "Close and reopen the app if retrying does not finish.",
          }),
          action: { label: retryLabel, onClick: handleApplyClick },
        };
      default:
        if (manualCheck === "up-to-date") {
          return {
            title: intl.formatMessage({
              id: "app.update.upToDate.title",
              defaultMessage: "Up to date",
            }),
            description: intl.formatMessage({
              id: "app.update.upToDate.description",
              defaultMessage: "You have the latest version of Green Goods.",
            }),
            action: { label: checkLabel, onClick: handleCheckClick },
          };
        }
        if (manualCheck === "failed") {
          return {
            title: intl.formatMessage({
              id: "app.update.checkFailed.title",
              defaultMessage: "Couldn't check for updates",
            }),
            description: intl.formatMessage({
              id: "app.update.checkFailed.description",
              defaultMessage: "Check your connection and try again.",
            }),
            action: { label: retryLabel, onClick: handleCheckClick },
          };
        }
        return {
          title: intl.formatMessage({
            id: "app.update.check.title",
            defaultMessage: "Check for updates",
          }),
          description: intl.formatMessage({
            id: "app.update.check.description",
            defaultMessage: "See if a newer version of Green Goods is available.",
          }),
          action: { label: checkLabel, onClick: handleCheckClick },
        };
    }
  };
  const updateRow = resolveUpdateRow();

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

      {/* Always present: with nothing pending there was no way to check (PWA-041). */}
      <Card>
        <div className="flex flex-row items-center gap-3 w-full">
          <Avatar>
            <div className="flex items-center justify-center text-center mx-auto text-primary">
              <RiRefreshLine className="w-4" />
            </div>
          </Avatar>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="text-sm font-medium">{updateRow.title}</div>
            <div role="status" className="text-xs text-text-sub-600 line-clamp-2">
              {updateRow.description}
            </div>
          </div>
          {updateRow.action ? (
            <Button
              variant="neutral"
              mode="stroke"
              size="small"
              onClick={updateRow.action.onClick}
              label={updateRow.action.label}
              className="w-[148px] shrink-0 sm:w-[168px]"
            />
          ) : null}
        </div>
      </Card>
    </>
  );
};
