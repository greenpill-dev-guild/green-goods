import {
  cn,
  DEFAULT_CHAIN_ID,
  getChainName,
  SideSheet,
  useAuth,
  useRole,
  useTheme,
} from "@green-goods/shared";
import {
  RiComputerLine,
  RiLogoutBoxLine,
  RiMoonLine,
  RiRocketLine,
  RiSettings3Line,
  RiSunLine,
  RiUserLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { AddressDisplay } from "../AddressDisplay";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

const THEME_OPTIONS = [
  { value: "light" as const, icon: RiSunLine, labelId: "cockpit.settings.lightMode" },
  { value: "dark" as const, icon: RiMoonLine, labelId: "cockpit.settings.darkMode" },
  { value: "system" as const, icon: RiComputerLine, labelId: "cockpit.settings.systemMode" },
];

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const { formatMessage } = useIntl();
  const { signOut, eoaAddress } = useAuth();
  const { role, isDeployer } = useRole();
  const { theme, setTheme } = useTheme();

  const title = formatMessage({ id: "cockpit.settings.title", defaultMessage: "Settings" });

  return (
    <SideSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-0 p-4">
        {/* User Profile Section */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-soft">
            {formatMessage({ id: "cockpit.settings.userProfile", defaultMessage: "Profile" })}
          </h3>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-soft">
              <RiUserLine className="h-5 w-5 text-text-sub" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-strong capitalize">{role}</div>
              {eoaAddress && (
                <div className="text-xs">
                  <AddressDisplay address={eoaAddress} showCopyButton />
                </div>
              )}
            </div>
          </div>
        </section>

        <hr className="my-4 border-stroke-soft" />

        {/* Theme Selector Section */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-soft">
            {formatMessage({ id: "cockpit.settings.theme", defaultMessage: "Theme" })}
          </h3>
          <div className="mt-3 flex gap-2">
            {THEME_OPTIONS.map(({ value, icon: Icon, labelId }) => {
              const isActive = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary-alpha-10 text-primary-dark border border-primary-light"
                      : "text-text-sub hover:bg-bg-soft border border-transparent"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {formatMessage({ id: labelId })}
                </button>
              );
            })}
          </div>
        </section>

        <hr className="my-4 border-stroke-soft" />

        {/* Chain Info Section */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-soft">
            {formatMessage({ id: "cockpit.settings.chainInfo", defaultMessage: "Network" })}
          </h3>
          <div className="mt-3 text-sm text-text-strong">{getChainName(DEFAULT_CHAIN_ID)}</div>
        </section>

        <hr className="my-4 border-stroke-soft" />

        {/* Disconnect Section */}
        <section>
          <button
            type="button"
            onClick={() => signOut?.()}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5",
              "text-sm font-medium text-error-base",
              "transition-colors hover:bg-error-lighter"
            )}
          >
            <RiLogoutBoxLine className="h-4 w-4" />
            {formatMessage({ id: "cockpit.settings.disconnect", defaultMessage: "Disconnect" })}
          </button>
        </section>

        {/* Deployer-only sections */}
        {isDeployer && (
          <>
            <hr className="my-4 border-stroke-soft" />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-soft">
                {formatMessage({
                  id: "cockpit.settings.contracts",
                  defaultMessage: "Contracts",
                })}
              </h3>
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-stroke-soft px-3 py-2.5">
                <RiSettings3Line className="h-5 w-5 text-text-soft" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-strong">
                    {formatMessage({
                      id: "cockpit.settings.contracts",
                      defaultMessage: "Contracts",
                    })}
                  </div>
                  <div className="text-xs text-text-soft">
                    {formatMessage({
                      id: "cockpit.settings.contractsDescription",
                      defaultMessage: "Manage deployed contracts",
                    })}
                  </div>
                </div>
              </div>
            </section>

            <hr className="my-4 border-stroke-soft" />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-soft">
                {formatMessage({
                  id: "cockpit.settings.deployment",
                  defaultMessage: "Deployment",
                })}
              </h3>
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-stroke-soft px-3 py-2.5">
                <RiRocketLine className="h-5 w-5 text-text-soft" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-strong">
                    {formatMessage({
                      id: "cockpit.settings.deployment",
                      defaultMessage: "Deployment",
                    })}
                  </div>
                  <div className="text-xs text-text-soft">
                    {formatMessage({
                      id: "cockpit.settings.deploymentDescription",
                      defaultMessage: "Deploy and update contracts",
                    })}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </SideSheet>
  );
}

export default SettingsSheet;
