import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { EditorialDivider } from "./atoms";

const FOOTER_NAV = [
  { path: "/gardens", labelId: "public.nav.gardens", defaultLabel: "Gardens" },
  { path: "/impact", labelId: "public.nav.impact", defaultLabel: "Impact" },
  { path: "/fund", labelId: "public.nav.fund", defaultLabel: "Fund" },
  { path: "/actions", labelId: "public.nav.actions", defaultLabel: "Actions" },
] as const;

/**
 * PublicFooter — closing editorial mark for every public-browser page.
 *
 * The dialect calls for a "quiet, lowercase footer with Green Goods, nav
 * links, and small legal/copyright text" (DESIGN.browser.md). The wordmark
 * is the visual signature: oversized italic Fraunces, set against the same
 * linen canvas, separated from the closing copy by a single hairline rule.
 *
 * Schedule-a-Call lives in the `PublicGetInTouch` section above the footer
 * — keeping it there preserves the editorial rhythm and avoids splitting
 * the contact moment across two surfaces.
 */
export function PublicFooter() {
  const { formatMessage } = useIntl();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-stroke-soft-200 bg-bg-weak-50">
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Link
            to="/"
            className="font-serif text-4xl font-normal italic leading-[0.9] tracking-[-0.02em] text-text-strong-950 md:text-5xl lg:text-6xl"
          >
            {formatMessage({
              id: "public.footer.wordmark",
              defaultMessage: "Green Goods",
            })}
          </Link>
          <nav
            className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-sub-600"
            aria-label={formatMessage({
              id: "public.footer.navLabel",
              defaultMessage: "Footer navigation",
            })}
          >
            {FOOTER_NAV.map(({ path, labelId, defaultLabel }) => (
              <Link key={path} to={path} className="transition-colors hover:text-text-strong-950">
                {formatMessage({ id: labelId, defaultMessage: defaultLabel })}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8">
          <EditorialDivider />
        </div>

        <p className="mt-4 text-xs leading-relaxed tracking-[0.02em] text-text-soft-400">
          {formatMessage(
            {
              id: "public.footer.legal",
              defaultMessage:
                "© {year} Green Goods. A living public record, rooted in regenerative work.",
            },
            { year: currentYear }
          )}
        </p>
      </div>
    </footer>
  );
}
