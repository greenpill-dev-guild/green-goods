import { useApp, useInstallGuidance } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { publicCuration } from "@/content/publicCuration";

/**
 * PublicHero — full-bleed editorial hero for browser `/`.
 *
 * Image-led, anchored bottom-left for strong contrast over warm imagery.
 * Stats, route grids, wallet connect, and waitlist forms do NOT live here —
 * the closing `Get In Touch` module owns subscription and appointments.
 */
export function PublicHero() {
  const { formatMessage } = useIntl();
  const { isMobile, platform, isInstalled, deferredPrompt } = useApp();
  const guidance = useInstallGuidance(
    platform,
    isMobile,
    isInstalled,
    null,
    deferredPrompt !== null
  );

  const installLabelId = isInstalled ? "public.nav.openApp" : "public.nav.installApp";
  const installDefault = isInstalled ? "Open App" : "Install App";

  return (
    <section
      className="relative isolate overflow-hidden text-static-white"
      aria-labelledby="public-hero-title"
    >
      <img
        src={publicCuration.heroImagePath}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        onError={(event) => {
          const fallback = publicCuration.fallbackImagePaths[0];
          if (fallback && event.currentTarget.src.indexOf(fallback) === -1) {
            event.currentTarget.src = fallback;
          }
        }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-static-black/70 via-static-black/40 to-static-black/10" />

      <div className="mx-auto flex min-h-[80vh] max-w-7xl flex-col justify-end px-6 py-16 sm:px-10 sm:py-24 md:py-32">
        <div className="max-w-2xl">
          <h1
            id="public-hero-title"
            className="font-serif text-5xl leading-tight tracking-tight md:text-7xl"
          >
            {formatMessage({ id: "public.home.hero.h1", defaultMessage: "Green Goods" })}
          </h1>
          <p className="mt-3 text-base font-medium text-static-white/90 md:text-lg">
            {formatMessage({
              id: "public.home.hero.tagline",
              defaultMessage: "From good intentions to green outcomes",
            })}
          </p>
          <p className="mt-4 max-w-xl text-sm text-static-white/80 md:text-base">
            {formatMessage({
              id: "public.home.hero.lede",
              defaultMessage:
                "Communities document, verify, and fund regenerative work onchain — Garden by Garden.",
            })}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/gardens"
              className="rounded-full bg-static-white px-6 py-3 text-sm font-semibold text-text-strong-950 shadow-sm transition-colors hover:bg-static-white/90"
            >
              {formatMessage({
                id: "public.home.hero.exploreGardens",
                defaultMessage: "Explore Gardens",
              })}
            </Link>
            <a
              href="#install"
              data-install-action={guidance.primaryAction.type}
              className="rounded-full border border-static-white/30 bg-static-white/10 px-6 py-3 text-sm font-semibold text-static-white backdrop-blur-sm transition-colors hover:bg-static-white/20"
            >
              {formatMessage({ id: installLabelId, defaultMessage: installDefault })}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
