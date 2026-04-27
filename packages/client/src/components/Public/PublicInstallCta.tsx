import { useApp, useInstallGuidance } from "@green-goods/shared";
import { useIntl } from "react-intl";

export interface PublicInstallCtaProps {
  variant?: "section" | "compact";
  className?: string;
}

/**
 * PublicInstallCta — install/open module reused on home, header, and drawers.
 *
 * Desktop scenario: shows guidance to open on mobile / use a recommended browser.
 * Already-installed: shows `Open App`.
 * Otherwise: surfaces install primary action label from `useInstallGuidance`.
 */
export function PublicInstallCta({ variant = "section", className = "" }: PublicInstallCtaProps) {
  const { formatMessage } = useIntl();
  const { isMobile, platform, isInstalled, deferredPrompt } = useApp();
  const guidance = useInstallGuidance(
    platform,
    isMobile,
    isInstalled,
    null,
    deferredPrompt !== null
  );

  const labelId = isInstalled ? "public.nav.openApp" : "public.nav.installApp";
  const defaultLabel = isInstalled ? "Open App" : "Install App";

  if (variant === "compact") {
    return (
      <a
        href="#install"
        data-install-action={guidance.primaryAction.type}
        className={`rounded-full bg-primary-action px-4 py-2 text-sm font-medium text-primary-action-foreground transition-colors hover:bg-primary-action-hover ${className}`}
      >
        {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
      </a>
    );
  }

  return (
    <section id="install" className="bg-bg-white-0 py-16" aria-labelledby="public-install-title">
      <div className="mx-auto max-w-3xl px-6 text-center sm:px-10">
        <h2
          id="public-install-title"
          className="font-serif text-2xl text-text-strong-950 md:text-3xl"
        >
          {formatMessage({
            id: "public.home.install.title",
            defaultMessage: "Bring the field with you",
          })}
        </h2>
        <p className="mt-4 text-sm text-text-sub-600 md:text-base">
          {formatMessage({
            id: "public.home.install.description",
            defaultMessage:
              "Install the Green Goods app to log Work, capture evidence, and follow Gardens you support — even offline.",
          })}
        </p>
        <div className="mt-8 flex justify-center">
          <a
            href="#install"
            data-install-action={guidance.primaryAction.type}
            className="rounded-full bg-primary-action px-6 py-3 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover"
          >
            {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
          </a>
        </div>
      </div>
    </section>
  );
}
