import { useIntl } from "react-intl";
import { PublicInstallAction } from "./PublicInstallAction";

export interface PublicInstallCtaProps {
  variant?: "section" | "compact";
  className?: string;
}

/**
 * PublicInstallCta — install/open module reused on public browser surfaces.
 *
 * The click behavior is owned by `PublicInstallAction`: desktop opens the QR
 * handoff, mobile tries native install first, and manual fallback opens in the
 * public install sheet.
 */
export function PublicInstallCta({ variant = "section", className = "" }: PublicInstallCtaProps) {
  const { formatMessage } = useIntl();

  if (variant === "compact") {
    return (
      <PublicInstallAction>
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
              "Install the Green Goods app to log Work, capture evidence, and follow Gardens you support, even offline.",
          })}
        </p>
        <div className="mt-8 flex justify-center">
          <PublicInstallAction>
            {({ label, href, onClick, disabled, dataInstallAction }) => (
              <a
                href={href}
                onClick={onClick}
                aria-disabled={disabled || undefined}
                data-install-action={dataInstallAction}
                className={`cursor-pointer rounded-full bg-primary-action px-6 py-3 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
              >
                {label}
              </a>
            )}
          </PublicInstallAction>
        </div>
      </div>
    </section>
  );
}
