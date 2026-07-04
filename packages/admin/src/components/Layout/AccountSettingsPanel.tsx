import {
  cn,
  DEFAULT_CHAIN_ID,
  getBlockExplorer,
  getChainName,
  SheetBody,
  SheetDivider,
  type Locale,
  useApp,
  useTheme,
} from "@green-goods/shared";
import { RiComputerLine, RiExternalLinkLine, RiMoonLine, RiSunLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

const THEME_OPTIONS = [
  { value: "light" as const, icon: RiSunLine, labelId: "cockpit.settings.lightMode" },
  { value: "dark" as const, icon: RiMoonLine, labelId: "cockpit.settings.darkMode" },
  { value: "system" as const, icon: RiComputerLine, labelId: "cockpit.settings.systemMode" },
];

/** Native-name labels — a language is its own proper noun, never translated. */
const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
};

const DOCS_URL = "https://docs.greengoods.app";
const SUPPORT_TELEGRAM_URL = "https://t.me/+N3o3_43iRec1Y2Jh";

interface AccountSettingsPanelProps {
  className?: string;
}

function SettingsSectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-text-strong">{title}</h2>
      {description ? <p className="mt-1 text-sm text-text-sub">{description}</p> : null}
    </div>
  );
}

function ExternalLinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-stroke-soft bg-bg-white-0 px-3 py-2",
        "text-sm font-medium text-text-strong transition-colors hover:bg-bg-soft",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]"
      )}
    >
      <span>{label}</span>
      <RiExternalLinkLine className="h-4 w-4 shrink-0 text-text-soft" aria-hidden="true" />
    </a>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-stroke-soft bg-bg-white-0 px-3 py-2">
      <span className="text-sm font-medium text-text-strong">{label}</span>
      <span className="text-sm tabular-nums text-text-sub">{value}</span>
    </div>
  );
}

/**
 * Settings panel — operator preferences behind the AppBar gear (desktop side
 * sheet) and the mobile Profile tab's "Settings" tab.
 *
 * Sections (flat M3 lists, no nested cards): Appearance, Language, Network,
 * About. Identity actions (Disconnect) live in the Account panel — settings
 * hold preferences, not who-you-are.
 */
export function AccountSettingsPanel({ className }: AccountSettingsPanelProps) {
  const { formatMessage } = useIntl();
  const { theme, setTheme } = useTheme();
  const { locale, availableLocales, switchLanguage } = useApp();
  const appVersion = import.meta.env.VITE_APP_VERSION || "dev";
  const chainName = getChainName(DEFAULT_CHAIN_ID);

  return (
    <SheetBody padded={true} className={cn("flex flex-col gap-4", className)}>
      {/* Appearance */}
      <section className="space-y-3">
        <SettingsSectionHeader
          title={formatMessage({ id: "cockpit.settings.theme", defaultMessage: "Theme" })}
          description={formatMessage({
            id: "cockpit.profile.theme.description",
            defaultMessage:
              "Choose the canvas atmosphere that feels best for long review sessions.",
          })}
        />
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
      </section>

      <SheetDivider />

      {/* Language */}
      <section className="space-y-3">
        <SettingsSectionHeader
          title={formatMessage({ id: "cockpit.settings.language", defaultMessage: "Language" })}
          description={formatMessage({
            id: "cockpit.settings.languageDescription",
            defaultMessage: "Choose the language for the operator canvas.",
          })}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          {availableLocales.map((availableLocale) => {
            const isActive = locale === availableLocale;
            return (
              <button
                key={availableLocale}
                type="button"
                onClick={() => switchLanguage(availableLocale as Locale)}
                data-state={isActive ? "active" : "inactive"}
                lang={availableLocale}
                className={cn(
                  "account-theme-option",
                  "flex min-h-11 items-center justify-between rounded-[var(--radius-md)] px-4 py-3 text-left transition-[background-color,box-shadow,color] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
                  isActive ? "text-[rgb(var(--tone-accent,37_99_235))]" : "text-text-sub"
                )}
              >
                <span className="text-sm font-medium">
                  {LOCALE_LABELS[availableLocale] ?? availableLocale.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <SheetDivider />

      {/* Network — build-time chain truth with an explorer escape hatch. */}
      <section className="space-y-3">
        <SettingsSectionHeader
          title={formatMessage({ id: "cockpit.settings.chainInfo", defaultMessage: "Network" })}
        />
        <InfoRow label={chainName} value={`Chain ID ${DEFAULT_CHAIN_ID}`} />
        <ExternalLinkRow
          href={getBlockExplorer(DEFAULT_CHAIN_ID)}
          label={formatMessage({
            id: "cockpit.account.viewOnExplorer",
            defaultMessage: "View on explorer",
          })}
        />
      </section>

      <SheetDivider />

      {/* About */}
      <section className="space-y-3">
        <SettingsSectionHeader
          title={formatMessage({ id: "cockpit.settings.about", defaultMessage: "About" })}
        />
        <InfoRow
          label={formatMessage({ id: "cockpit.settings.version", defaultMessage: "Version" })}
          value={appVersion}
        />
        <ExternalLinkRow
          href={DOCS_URL}
          label={formatMessage({ id: "cockpit.settings.docs", defaultMessage: "Documentation" })}
        />
        <ExternalLinkRow
          href={SUPPORT_TELEGRAM_URL}
          label={formatMessage({ id: "cockpit.settings.support", defaultMessage: "Support" })}
        />
      </section>
    </SheetBody>
  );
}
