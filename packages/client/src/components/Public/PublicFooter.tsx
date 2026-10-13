import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { cn } from "@green-goods/shared/utils/styles/cn";

interface FooterLink {
  href: string;
  labelId: string;
  defaultLabel: string;
}

// Only the project's outside homes. The site's own routes are the header's job
// (DESIGN.browser.md § Compact utility footer).
const FOOTER_LINKS: readonly FooterLink[] = [
  {
    href: "https://x.com/greengoodsapp",
    labelId: "public.footer.twitter",
    defaultLabel: "Twitter",
  },
  {
    href: "https://www.linkedin.com/company/greengoodsapp/",
    labelId: "public.footer.linkedin",
    defaultLabel: "LinkedIn",
  },
  {
    href: "https://github.com/greenpill-dev-guild/green-goods",
    labelId: "public.footer.github",
    defaultLabel: "GitHub",
  },
  { href: "https://docs.greengoods.app", labelId: "public.footer.docs", defaultLabel: "Docs" },
] as const;

export type PublicFooterVariant = "default" | "soil";

interface PublicFooterProps {
  variant?: PublicFooterVariant;
}

/**
 * PublicFooter — compact utility footer for every public-browser page.
 *
 * Single row at desktop with a small wordmark, restored provenance line, and
 * right-aligned links to Twitter, LinkedIn, GitHub, and Docs. Stacks gracefully on
 * mobile. Schedule-a-Call lives in `PublicGetInTouch` above the footer; the
 * footer stays quiet.
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
        "@container mt-auto border-t px-6 py-6 sm:px-10 sm:py-5",
        isSoil ? "border-static-white/10 bg-editorial-deep" : "border-stroke-soft-200 bg-bg-weak-50"
      )}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-8 @min-[70rem]:grid-cols-[1fr_auto_1fr]">
        <Link
          to="/"
          viewTransition
          className={cn(
            "justify-self-start whitespace-nowrap font-serif text-base font-medium tracking-[-0.01em]",
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
            "text-xs tracking-[0.02em] sm:col-span-2 sm:row-start-2 @min-[70rem]:col-span-1 @min-[70rem]:col-start-2 @min-[70rem]:row-start-1 @min-[70rem]:justify-self-center @min-[70rem]:text-center",
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
            "flex flex-wrap items-center gap-x-5 gap-y-1 text-xs tracking-[0.02em] sm:col-start-2 sm:row-start-1 sm:justify-self-end sm:text-right @min-[70rem]:col-start-3",
            isSoil ? "text-static-white/72" : "text-text-sub-600"
          )}
          aria-label={formatMessage({
            id: "public.footer.navLabel",
            defaultMessage: "Footer links",
          })}
        >
          {FOOTER_LINKS.map(({ href, labelId, defaultLabel }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                isSoil
                  ? "text-static-white/85 hover:text-static-white focus-visible:ring-static-white/60 focus-visible:ring-offset-[rgb(var(--editorial-deep-rgb))]"
                  : "text-text-sub-600 hover:text-primary-action-hover focus-visible:ring-primary-action focus-visible:ring-offset-bg-weak-50"
              )}
            >
              {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
