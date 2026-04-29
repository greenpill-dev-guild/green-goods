import { useApp, useInstallGuidance, usePublicInstallHandler } from "@green-goods/shared";
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
 *
 * Section variant additionally renders `guidance.manualInstructions` when the
 * scenario calls for it (iOS Safari Add-to-Home, Android manual flow), so
 * users who land here from a header/hero CTA see real next steps.
 */
export function PublicInstallCta({ variant = "section", className = "" }: PublicInstallCtaProps) {
  const { formatMessage } = useIntl();
  const { isMobile, platform, isInstalled, wasInstalled, deferredPrompt, promptInstall } = useApp();
  const guidance = useInstallGuidance(
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    isMobile
  );
  const handleInstallClick = usePublicInstallHandler(guidance, promptInstall);

  const labelId = isInstalled ? "public.nav.openApp" : "public.nav.installApp";
  const defaultLabel = isInstalled ? "Open App" : "Install App";

  if (variant === "compact") {
    return (
      <a
        href="#install"
        onClick={handleInstallClick}
        data-install-action={guidance.primaryAction.type}
        className={`rounded-full bg-primary-action px-4 py-2 text-sm font-medium text-primary-action-foreground transition-colors hover:bg-primary-action-hover ${className}`}
      >
        {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
      </a>
    );
  }

  const showManualSteps =
    !isInstalled && guidance.manualInstructions && guidance.manualInstructions.length > 0;
  const browserSwitchReason = !isInstalled ? guidance.browserSwitchReason : null;

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
            onClick={handleInstallClick}
            data-install-action={guidance.primaryAction.type}
            className="rounded-full bg-primary-action px-6 py-3 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover"
          >
            {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
          </a>
        </div>

        {browserSwitchReason ? (
          <p className="mx-auto mt-6 max-w-xl text-sm text-text-sub-600">{browserSwitchReason}</p>
        ) : null}

        {showManualSteps && guidance.manualInstructions ? (
          <ol className="mx-auto mt-8 max-w-xl space-y-3 text-left text-sm text-text-sub-600">
            {guidance.manualInstructions.map((step) => (
              <li
                key={step.stepNumber}
                className="flex gap-3 rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 p-3"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-action text-xs font-semibold text-primary-action-foreground">
                  {step.stepNumber}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-text-strong-950">{step.title}</p>
                  <p className="mt-1">{step.description.replace(/\*\*/g, "")}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
