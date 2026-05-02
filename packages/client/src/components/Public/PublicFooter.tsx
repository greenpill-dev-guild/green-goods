import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { cn } from "@green-goods/shared";

const FOOTER_LINKS = [
  {
    to: "/gardens",
    labelId: "public.nav.gardens",
    defaultLabel: "Gardens",
  },
  {
    to: "/impact",
    labelId: "public.nav.impact",
    defaultLabel: "Impact",
  },
  {
    to: "/fund",
    labelId: "public.nav.fund",
    defaultLabel: "Fund",
  },
  {
    to: "/actions",
    labelId: "public.nav.actions",
    defaultLabel: "Actions",
  },
  {
    to: "mailto:afo@greenpill.builders",
    labelId: "public.footer.contact",
    defaultLabel: "Contact",
  },
] as const;

export type PublicFooterVariant = "default" | "soil";

interface PublicFooterProps {
  variant?: PublicFooterVariant;
}

/**
 * PublicFooter — compact utility footer for every public-browser page.
 *
 * Single row at desktop with a small wordmark, restored provenance line, and
 * right-aligned public nav. Stacks gracefully on mobile. Schedule-a-Call lives
 * in `PublicGetInTouch` above the footer; the footer stays quiet.
 *
 * Variants:
 * - `default` — light surface, used on Home.
 * - `soil` — deep warm-brown surface (`--neutral-900`), used on sub-pages so
 *   the page lands "in the soil" at the bottom.
 */
export function PublicFooter({ variant = "default" }: PublicFooterProps) {
  const { formatMessage } = useIntl();
  const currentYear = new Date().getFullYear();

  const isSoil = variant === "soil";

  return (
    <footer
      className={cn(
        "border-t px-6 py-6 sm:px-10 sm:py-5",
        isSoil
          ? "border-[rgb(var(--neutral-800))] bg-[rgb(var(--neutral-900))]"
          : "border-stroke-soft-200 bg-bg-weak-50"
      )}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-x-8">
        <Link
          to="/"
          className={cn(
            "justify-self-start font-serif text-base font-medium tracking-[-0.01em]",
            isSoil ? "text-static-white" : "text-text-strong-950"
          )}
        >
          {formatMessage({
            id: "public.footer.wordmark",
            defaultMessage: "Green Goods",
          })}
        </Link>

        <p
          className={cn(
            "text-xs tracking-[0.02em] sm:justify-self-center sm:text-center",
            isSoil ? "text-static-white/72" : "text-text-sub-600"
          )}
        >
          {formatMessage(
            {
              id: "public.footer.legal",
              defaultMessage:
                "© {year} Green Goods. A living public record, rooted in regenerative work.",
            },
            { year: currentYear }
          )}
        </p>

        <nav
          className={cn(
            "flex flex-wrap items-center gap-x-5 gap-y-1 text-xs tracking-[0.02em] sm:justify-self-end sm:text-right",
            isSoil ? "text-static-white/72" : "text-text-sub-600"
          )}
          aria-label={formatMessage({
            id: "public.footer.navLabel",
            defaultMessage: "Footer links",
          })}
        >
          {FOOTER_LINKS.map(({ to, labelId, defaultLabel }) => {
            const linkClass = cn(
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              isSoil
                ? "text-static-white/85 hover:text-static-white focus-visible:ring-static-white/60 focus-visible:ring-offset-[rgb(var(--neutral-900))]"
                : "text-text-sub-600 hover:text-primary-action focus-visible:ring-primary-action focus-visible:ring-offset-bg-weak-50"
            );
            return to.startsWith("mailto:") ? (
              <a key={to} href={to} className={linkClass}>
                {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
              </a>
            ) : (
              <Link key={to} to={to} className={linkClass}>
                {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
              </Link>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
