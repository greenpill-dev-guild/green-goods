import {
  cn,
  DEFAULT_CHAIN_ID,
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
      <section className="surface-inset space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-text-strong">
            {formatMessage({ id: "cockpit.settings.theme", defaultMessage: "Theme" })}
          </h2>
          <p className="mt-1 text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.profile.theme.description",
              defaultMessage:
                "Choose the cockpit atmosphere that feels best for long review sessions.",
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
                  "shadow-[var(--edge-rest)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                  isActive
                    ? "bg-primary-alpha-10 text-primary-dark shadow-[var(--edge-hover),0_12px_24px_rgba(31,193,107,0.12)]"
                    : "bg-bg-white text-text-sub hover:bg-bg-soft"
                )}
              >
                <span className="text-sm font-medium">{formatMessage({ id: labelId })}</span>
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="surface-inset space-y-3 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-text-strong">
          {formatMessage({ id: "cockpit.settings.chainInfo", defaultMessage: "Network" })}
        </h2>
        <div className="rounded-2xl bg-bg-soft/80 px-4 py-3 shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.04)]">
          <p className="text-sm font-medium text-text-strong">{getChainName(DEFAULT_CHAIN_ID)}</p>
        </div>
      </section>

      <section className="surface-inset p-2">
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
      </section>
    </div>
  );
}
