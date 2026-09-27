import { Button } from "@green-goods/shared/components/Button";
import { Switch } from "@green-goods/shared/components/Form/ControlPrimitives";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useServiceWorkerUpdate } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import { useTheme } from "@green-goods/shared/hooks/app/useTheme";
import { type Locale, useApp } from "@green-goods/shared/providers/App";
import {
  hapticSelection,
  isHapticsEnabled,
  isHapticsSupported,
  setHapticsEnabled,
} from "@green-goods/shared/utils/app/haptics";
import { capitalize } from "@green-goods/shared/utils/app/text";
import { RiEarthFill, RiRefreshLine, RiSettings2Line, RiVolumeVibrateLine } from "@remixicon/react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Inputs";
import { OfflineContentRow } from "./OfflineContentRow";

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
 * One width for every control in the settings column. 120px fits the busiest
 * button label with its spinner; the subtitle beside it gives up every pixel
 * this grows by.
 */
const SETTING_CONTROL_WIDTH = "w-[120px] sm:w-[140px]";

/**
 * A select keeps its value on one line. The trigger leaves 66px for the text,
 * and "Português" is a few pixels wider than that in Inter. The shared trigger
 * wraps a value that does not fit, which broke it across two lines; held on
 * one line it borrows those pixels from the gap before the chevron instead.
 * Radix drops a className given to SelectValue, so the trigger styles the span.
 */
const SETTING_SELECT_TRIGGER = `${SETTING_CONTROL_WIDTH} [&>span]:whitespace-nowrap`;

/**
 * Every subtitle reserves two lines whether or not it wraps, so the settings
 * cards stay the same height and a status change never moves the row.
 */
const SETTING_DESCRIPTION = "min-h-8 text-xs text-text-sub-600 line-clamp-2";

/** One settings row: an icon, a fixed title, its two-line description, and one control. */
function SettingRow({
  icon,
  title,
  titleId,
  description,
  control,
}: {
  icon: ReactNode;
  title: string;
  titleId?: string;
  description: ReactNode;
  control: ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-row items-center gap-3 w-full">
        <Avatar>
          <div className="flex items-center justify-center text-center mx-auto text-primary">
            {icon}
          </div>
        </Avatar>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div id={titleId} className="text-sm font-medium truncate">
            {title}
          </div>
          {description}
        </div>
        <div className="shrink-0">{control}</div>
      </div>
    </Card>
  );
}

export const AppSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { locale, switchLanguage, availableLocales } = useApp();
  const { phase, checkForUpdate, activateNow, activationBlocked } = useServiceWorkerUpdate();
  const intl = useIntl();
  // Where the device cannot vibrate (iPhones have no Vibration API) the switch
  // would do nothing, so the row is not offered at all.
  const canVibrate = isHapticsSupported();
  const [vibrationOn, setVibrationOn] = useState(isHapticsEnabled);
  const vibrationTitleId = useId();

  const handleVibrationChange = (enabled: boolean) => {
    setHapticsEnabled(enabled);
    setVibrationOn(enabled);
    // The press listener read the preference before this switch changed it,
    // so switching on is the one press it could not answer: preview it here.
    if (enabled) hapticSelection();
  };

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
            <SelectTrigger size="sm" className={SETTING_SELECT_TRIGGER}>
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
          // Controlled like Theme. With no value the trigger showed the language
          // as its placeholder, in the muted placeholder colour.
          <Select value={locale} onValueChange={(val) => switchLanguage(val as Locale)}>
            <SelectTrigger size="sm" className={SETTING_SELECT_TRIGGER}>
              <SelectValue
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
    // Only ask the registration to look for a newer worker and act on what it
    // reports. Nothing on this path unregisters the worker or clears a cache;
    // that is what stranded installed users on the app-files screen before.
    // The row itself returns to its default state; outcomes that need words
    // arrive as toasts, and "pending" or "failed" show through the phase.
    void checkForUpdate().then(
      (result) => {
        if (result === "up-to-date") {
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
            defaultMessage: "Close every app window, then open it again.",
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
        <SettingRow
          key={title}
          icon={Icon}
          title={title}
          description={<div className={SETTING_DESCRIPTION}>{description}</div>}
          control={<Option />}
        />
      ))}

      {canVibrate ? (
        <SettingRow
          icon={<RiVolumeVibrateLine className="w-4" />}
          title={intl.formatMessage({ id: "app.settings.vibration", defaultMessage: "Vibration" })}
          titleId={vibrationTitleId}
          description={
            <div className={SETTING_DESCRIPTION}>
              {intl.formatMessage({
                id: "app.settings.vibrationDescription",
                defaultMessage: "Vibrate lightly when you tap",
              })}
            </div>
          }
          control={
            <Switch
              checked={vibrationOn}
              onCheckedChange={handleVibrationChange}
              aria-labelledby={vibrationTitleId}
            />
          }
        />
      ) : null}

      <OfflineContentRow controlClassName={SETTING_CONTROL_WIDTH} />

      {/* Always present: with nothing pending there was no way to check (PWA-041). */}
      <SettingRow
        icon={<RiRefreshLine className="w-4" />}
        title={intl.formatMessage({
          id: "app.update.check.title",
          defaultMessage: "Update",
        })}
        description={
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
        }
        control={
          <Button
            type="button"
            emphasis="secondary"
            size="sm"
            loading={updateRow.busy}
            disabled={phase === "waiting" && activationBlocked}
            onClick={updateRow.onClick}
            className={SETTING_CONTROL_WIDTH}
          >
            {updateRow.label}
          </Button>
        }
      />
    </>
  );
};
