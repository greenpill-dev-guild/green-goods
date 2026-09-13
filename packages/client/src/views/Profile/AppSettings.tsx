import { useOfflinePreparationStatus } from "@green-goods/shared/hooks/offline/useOfflineContent";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { capitalize } from "@green-goods/shared/utils/app/text";
import { hapticLight } from "@green-goods/shared/utils/app/haptics";
import { type Locale, useApp } from "@green-goods/shared/providers/App";
import { useServiceWorkerUpdate } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import { useTheme } from "@green-goods/shared/hooks/app/useTheme";
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

/**
 * The update row is a settings row like Theme and Language: a fixed title, a
 * status line, and one control that is always present at a constant size so
 * nothing in the card moves between states.
 */
interface UpdateRow {
  status: string;
  label: string;
  busy: boolean;
  onClick?: () => void;
}

/**
 * One width for every control in the settings column. 120px fits the widest
 * select value ("Português") and the busiest button label with its spinner.
 */
const SETTING_CONTROL_WIDTH = "w-[120px] sm:w-[140px]";

/**
 * Every subtitle reserves two lines whether or not it wraps, so the three
 * cards stay the same height and a status change never moves the row.
 */
const SETTING_DESCRIPTION = "min-h-8 text-xs text-text-sub-600 line-clamp-2";

export const AppSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const preparation = useOfflinePreparationStatus();
  const isOnline = useOnlineStatus();
  const { locale, switchLanguage, availableLocales } = useApp();
  const { phase, checkForUpdate, activateNow, activationBlocked } = useServiceWorkerUpdate();
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
            <SelectTrigger size="sm" className={SETTING_CONTROL_WIDTH}>
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
            <SelectTrigger size="sm" className={SETTING_CONTROL_WIDTH}>
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
    // Only ask the registration to look for a newer worker and act on what it
    // reports. Nothing on this path unregisters the worker or clears a cache;
    // that is what stranded installed users on the app-files screen before.
    // The row itself returns to its default state; outcomes that need words
    // arrive as toasts, and "pending" or "failed" show through the phase.
    void checkForUpdate().then(
      (result) => {
        if (result === "ready") {
          // Tapping Check carries the intent to update, so apply the waiting
          // worker straight away instead of asking for a second tap.
          activateNow();
        } else if (result === "up-to-date") {
          toastService.info({
            title: intl.formatMessage({
              id: "app.update.toast.upToDate.title",
              defaultMessage: "No update available",
            }),
            message: intl.formatMessage({
              id: "app.update.toast.upToDate.message",
              defaultMessage: "You're on the latest version.",
            }),
            context: "app update",
            suppressLogging: true,
          });
        }
      },
      () =>
        toastService.error({
          title: intl.formatMessage({
            id: "app.update.toast.checkFailed.title",
            defaultMessage: "Couldn't check for updates",
          }),
          message: intl.formatMessage({
            id: "app.update.toast.checkFailed.message",
            defaultMessage: "Check your connection and try again.",
          }),
          context: "app update",
          suppressLogging: true,
        })
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
          status: intl.formatMessage({
            id: "app.update.checking.description",
            defaultMessage: "Looking for a newer version.",
          }),
          label: intl.formatMessage({
            id: "app.update.checkingButton",
            defaultMessage: "Checking",
          }),
          busy: true,
        };
      case "downloading":
        return {
          status: intl.formatMessage({
            id: "app.update.installing.description",
            defaultMessage: "Installing the latest version.",
          }),
          label: intl.formatMessage({
            id: "app.update.installingButton",
            defaultMessage: "Installing",
          }),
          busy: true,
        };
      case "waiting":
        return {
          status: activationBlocked
            ? intl.formatMessage({
                id: "app.update.finishWork",
                defaultMessage: "Finish saving or sending your work before restarting.",
              })
            : intl.formatMessage({
                id: "app.update.subtitle",
                defaultMessage: "A new version is ready.",
              }),
          label: intl.formatMessage({ id: "app.update.restartButton", defaultMessage: "Restart" }),
          busy: false,
          onClick: handleApplyClick,
        };
      case "activating":
        return {
          status: intl.formatMessage({
            id: "app.update.applying.description",
            defaultMessage: "Restarting the app.",
          }),
          label: intl.formatMessage({ id: "app.update.restartButton", defaultMessage: "Restart" }),
          busy: true,
        };
      case "error":
        return {
          status: intl.formatMessage({
            id: "app.update.stalled.description",
            defaultMessage: "Close and reopen the app.",
          }),
          label: retryLabel,
          busy: false,
          onClick: handleApplyClick,
        };
      case "install-failed":
        return {
          status: intl.formatMessage({
            id: "app.update.installFailed.description",
            defaultMessage: "Couldn't finish. Try again.",
          }),
          label: retryLabel,
          busy: false,
          onClick: handleCheckClick,
        };
      default:
        return {
          status: intl.formatMessage({
            id: "app.update.check.description",
            defaultMessage: "Check for a newer version.",
          }),
          label: checkLabel,
          busy: false,
          onClick: handleCheckClick,
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
              <div className={SETTING_DESCRIPTION}>{description}</div>
            </div>
            <div className="shrink-0">
              <Option />
            </div>
          </div>
        </Card>
      ))}

      <Card>
        <div className="flex items-center gap-3 w-full">
          <Avatar>
            <RiRefreshLine className="w-4 text-primary" />
          </Avatar>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="text-sm font-medium">
              {intl.formatMessage({
                id: "app.offline.preparation.title",
                defaultMessage: "Offline content",
              })}
            </div>
            <div
              role="status"
              aria-label={intl.formatMessage({
                id: "app.offline.preparation.title",
                defaultMessage: "Offline content",
              })}
              className="text-xs text-text-sub-600"
            >
              {intl.formatMessage({
                id: preparation.busy
                  ? "app.offline.preparation.preparing"
                  : preparation.partial
                    ? "app.offline.preparation.partial"
                    : "app.offline.preparation.ready",
                defaultMessage: preparation.busy
                  ? "Preparing content…"
                  : preparation.partial
                    ? "Partially available offline"
                    : "Ready to use offline",
              })}
              {" · "}
              {intl.formatMessage(
                { id: "app.offline.preparation.storage", defaultMessage: "{used} of {budget} MiB" },
                {
                  used: (preparation.bytes / 1024 / 1024).toFixed(1),
                  budget: preparation.budget / 1024 / 1024,
                }
              )}
              {preparation.updatedAt && (
                <div>
                  {intl.formatMessage(
                    { id: "app.offline.preparation.updated", defaultMessage: "Updated {date}" },
                    {
                      date: intl.formatDate(preparation.updatedAt, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                      }),
                    }
                  )}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="neutral"
            mode="stroke"
            size="small"
            className={SETTING_CONTROL_WIDTH}
            disabled={!isOnline || preparation.busy}
            isLoading={preparation.busy}
            onClick={preparation.retry}
            label={intl.formatMessage({
              id: "app.offline.preparation.retry",
              defaultMessage: "Retry",
            })}
          />
        </div>
      </Card>

      {/* Always present: with nothing pending there was no way to check (PWA-041). */}
      <Card>
        <div className="flex flex-row items-center gap-3 w-full">
          <Avatar>
            <div className="flex items-center justify-center text-center mx-auto text-primary">
              <RiRefreshLine className="w-4" />
            </div>
          </Avatar>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="text-sm font-medium truncate">
              {intl.formatMessage({
                id: "app.update.check.title",
                defaultMessage: "Update",
              })}
            </div>
            <div
              role="status"
              aria-label={intl.formatMessage({
                id: "app.update.check.title",
                defaultMessage: "Update",
              })}
              className={SETTING_DESCRIPTION}
            >
              {updateRow.status}
            </div>
          </div>
          <div className="shrink-0">
            <Button
              variant="neutral"
              mode="stroke"
              size="small"
              isLoading={updateRow.busy}
              disabled={phase === "waiting" && activationBlocked}
              onClick={updateRow.onClick}
              label={updateRow.label}
              className={SETTING_CONTROL_WIDTH}
            />
          </div>
        </div>
      </Card>
    </>
  );
};
