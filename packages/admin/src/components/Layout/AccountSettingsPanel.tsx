import {
  cn,
  DEFAULT_CHAIN_ID,
  SheetBody,
  SheetDivider,
  SheetFooter,
  Surface,
  getChainName,
  useAuthActions,
  useTheme,
} from "@green-goods/shared";
import { RiComputerLine, RiLogoutBoxLine, RiMoonLine, RiSunLine } from "@remixicon/react";
import { useIntl } from "react-intl";

const THEME_OPTIONS = [
  { value: "light" as const, icon: RiSunLine, labelId: "cockpit.settings.lightMode" },
  { value: "dark" as const, icon: RiMoonLine, labelId: "cockpit.settings.darkMode" },
  { value: "system" as const, icon: RiComputerLine, labelId: "cockpit.settings.systemMode" },
];

interface AccountSettingsPanelProps {
  className?: string;
}

export function AccountSettingsPanel({ className }: AccountSettingsPanelProps) {
  const { formatMessage } = useIntl();
  const { signOut } = useAuthActions();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <SheetBody padded={true} className={cn("flex flex-col gap-4", className)}>
        <Surface elevation="solid-raised" padding="default" className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-text-strong">
              {formatMessage({ id: "cockpit.settings.theme", defaultMessage: "Theme" })}
            </h2>
            <p className="mt-1 text-sm text-text-sub">
              {formatMessage({
                id: "cockpit.profile.theme.description",
                defaultMessage:
                  "Choose the canvas atmosphere that feels best for long review sessions.",
              })}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {THEME_OPTIONS.map(({ value, icon: Icon, labelId }) => {
              const isActive = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  data-state={isActive ? "active" : "inactive"}
                  className={cn(
                    "account-theme-option",
                    "flex min-h-11 items-center justify-between rounded-[var(--radius-md)] px-4 py-3 text-left transition-[background-color,box-shadow,color] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
                    isActive ? "text-[rgb(var(--tone-accent,37_99_235))]" : "text-text-sub"
                  )}
                >
                  <span className="text-sm font-medium">{formatMessage({ id: labelId })}</span>
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </Surface>

        <SheetDivider />

        <Surface elevation="solid-raised" padding="default" className="space-y-3">
          <h2 className="text-sm font-semibold text-text-strong">
            {formatMessage({ id: "cockpit.settings.chainInfo", defaultMessage: "Network" })}
          </h2>
          <Surface elevation="solid-ground" padding="compact" radius="md">
            <p className="text-sm font-medium text-text-strong">{getChainName(DEFAULT_CHAIN_ID)}</p>
          </Surface>
        </Surface>
      </SheetBody>

      <SheetFooter>
        <button
          type="button"
          onClick={() => signOut()}
          className={cn(
            "flex min-h-11 w-full items-center justify-between rounded-full px-4 py-3",
            "text-sm font-medium text-error-base transition-colors hover:bg-error-lighter"
          )}
        >
          <span>
            {formatMessage({ id: "cockpit.settings.disconnect", defaultMessage: "Disconnect" })}
          </span>
          <RiLogoutBoxLine className="h-4 w-4" />
        </button>
      </SheetFooter>
    </>
  );
}
