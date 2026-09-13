import { Button } from "@green-goods/shared/components/Button";
import { useIntl } from "react-intl";
import { getSharedRecordPath } from "@/config/sharedLink";
import { PublicInstallAction } from "./PublicInstallAction";

export interface PublicInstallCtaProps {
  variant?: "section" | "compact";
  className?: string;
  destination?: string;
}

/**
 * PublicInstallCta — install/open module reused on public browser surfaces.
 *
 * The click behavior is owned by `PublicInstallAction`: desktop opens the QR
 * handoff, mobile tries native install first, and manual fallback opens in the
 * public install sheet.
 */
export function PublicInstallCta({
  variant = "section",
  className = "",
  destination,
}: PublicInstallCtaProps) {
  const { formatMessage } = useIntl();
  const currentPath =
    typeof window === "undefined"
      ? ""
      : window.location.hash.startsWith("#/")
        ? window.location.hash.slice(1).split("?")[0]
        : window.location.pathname;
  const recordPath = getSharedRecordPath(destination ?? currentPath, "home");
  const continuation = recordPath ? (
    <div className="mt-4 text-center text-sm text-text-sub-600">
      <p>
        {formatMessage({
          id: "public.sharedLink.installHelp",
          defaultMessage:
            "After installing, return to this page to continue. You can keep reading here without installing.",
        })}
      </p>
      <PublicInstallAction forceOpenApp destination={recordPath}>
        {({ href, onClick, disabled }) => (
          <Button asChild emphasis="tertiary" className="mt-3">
            <a href={href} onClick={onClick} aria-disabled={disabled || undefined}>
              {formatMessage({
                id: recordPath.includes("/work/")
                  ? "public.sharedLink.openWork"
                  : "public.sharedLink.openGarden",
                defaultMessage: recordPath.includes("/work/")
                  ? "Open This Work in the App"
                  : "Open This Garden in the App",
              })}
            </a>
          </Button>
        )}
      </PublicInstallAction>
    </div>
  ) : null;

  if (variant === "compact") {
    return (
      <div className={className}>
        <PublicInstallAction destination={recordPath ?? undefined}>
          {({ label, href, onClick, disabled, dataInstallAction }) => (
            <Button asChild>
              <a
                href={href}
                onClick={onClick}
                aria-disabled={disabled || undefined}
                data-install-action={dataInstallAction}
              >
                {label}
              </a>
            </Button>
          )}
        </PublicInstallAction>
        {continuation}
      </div>
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
              "Install the Green Goods app to log Work, capture evidence, and keep up with Gardens you support, even offline.",
          })}
        </p>
        <div className="mt-8 flex justify-center">
          <PublicInstallAction destination={recordPath ?? undefined}>
            {({
              label,
              href,
              onClick,
              disabled,
              dataInstallAction,
              hasInstallFallback,
              fallbackLabel,
              onInstallFallbackClick,
            }) => (
              <div className="flex flex-col items-center gap-3">
                <Button asChild>
                  <a
                    href={href}
                    onClick={onClick}
                    aria-disabled={disabled || undefined}
                    data-install-action={dataInstallAction}
                  >
                    {label}
                  </a>
                </Button>
                {hasInstallFallback ? (
                  <Button type="button" emphasis="tertiary" onClick={onInstallFallbackClick}>
                    {fallbackLabel}
                  </Button>
                ) : null}
              </div>
            )}
          </PublicInstallAction>
        </div>
        {continuation}
      </div>
    </section>
  );
}
