import { useIntl } from "react-intl";
import { createSharedLinkLaunchUrl, getSharedRecordPath } from "@/config/sharedLink";
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
  const recordHref =
    recordPath && import.meta.env.VITE_USE_HASH_ROUTER === "true"
      ? createSharedLinkLaunchUrl(recordPath, window.location.href, true)
      : recordPath;
  const continuation = recordPath ? (
    <div className="mt-4 text-center text-sm text-text-sub-600">
      <p>
        {formatMessage({
          id: "public.sharedLink.installHelp",
          defaultMessage:
            "After installing, return to this page to continue. You can keep reading here without installing.",
        })}
      </p>
      <a
        href={recordHref ?? undefined}
        className="mt-3 inline-flex min-h-11 items-center text-primary-action underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
      >
        {formatMessage({
          id: recordPath.includes("/work/")
            ? "public.sharedLink.openWork"
            : "public.sharedLink.openGarden",
          defaultMessage: recordPath.includes("/work/")
            ? "Open This Work in the App"
            : "Open This Garden in the App",
        })}
      </a>
    </div>
  ) : null;

  if (variant === "compact") {
    return (
      <div className={className}>
        <PublicInstallAction destination={recordPath ?? undefined}>
          {({ label, href, onClick, disabled, dataInstallAction }) => (
            <a
              href={href}
              onClick={onClick}
              aria-disabled={disabled || undefined}
              data-install-action={dataInstallAction}
              className={`cursor-pointer rounded-full bg-primary-action px-4 py-2 text-sm font-medium text-primary-action-foreground transition-colors hover:bg-primary-action-hover ${disabled ? "cursor-not-allowed opacity-70" : ""} ${className}`}
            >
              {label}
            </a>
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
                <a
                  href={href}
                  onClick={onClick}
                  aria-disabled={disabled || undefined}
                  data-install-action={dataInstallAction}
                  className={`cursor-pointer rounded-full bg-primary-action px-6 py-3 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  {label}
                </a>
                {hasInstallFallback ? (
                  <button
                    type="button"
                    onClick={onInstallFallbackClick}
                    className="cursor-pointer text-sm font-medium text-text-sub-600 underline-offset-4 hover:text-text-strong-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
                  >
                    {fallbackLabel}
                  </button>
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
