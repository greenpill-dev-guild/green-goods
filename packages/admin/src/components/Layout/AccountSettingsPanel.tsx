import {
  cn,
  DEFAULT_CHAIN_ID,
  Surface,
  getChainName,
  useAuth,
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
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Surface elevation="raised" padding="default" className="space-y-4">
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
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-left transition-all duration-200",
                  "shadow-[var(--edge-rest),0_10px_20px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                  isActive
                    ? "bg-[rgb(var(--workspace-tint,59_130_246)/0.14)] text-[rgb(var(--workspace-accent,37_99_235))] shadow-[inset_0_0_0_1px_rgb(var(--workspace-tint,59_130_246)/0.18),0_18px_32px_rgb(var(--workspace-tint,59_130_246)/0.18)]"
                    : "bg-bg-white text-text-sub hover:bg-[rgb(var(--workspace-tint,59_130_246)/0.06)]"
                )}
              >
                <span className="text-sm font-medium">{formatMessage({ id: labelId })}</span>
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </Surface>

      <Surface elevation="raised" padding="default" className="space-y-3">
        <h2 className="text-sm font-semibold text-text-strong">
          {formatMessage({ id: "cockpit.settings.chainInfo", defaultMessage: "Network" })}
        </h2>
        <div className="rounded-2xl bg-bg-soft/80 px-4 py-3 shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.04)]">
          <p className="text-sm font-medium text-text-strong">{getChainName(DEFAULT_CHAIN_ID)}</p>
        </div>
      </Surface>

      <Surface elevation="raised" padding="compact">
        <button
          type="button"
          onClick={() => signOut?.()}
          className={cn(
            "flex w-full items-center justify-between rounded-[1.25rem] px-4 py-3",
            "text-sm font-medium text-error-base transition-colors hover:bg-error-lighter"
          )}
        >
          <span>
            {formatMessage({ id: "cockpit.settings.disconnect", defaultMessage: "Disconnect" })}
          </span>
          <RiLogoutBoxLine className="h-4 w-4" />
        </button>
      </Surface>
    </div>
  );
}
