import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { EditorialDivider, EditorialHeading, EditorialKicker, EditorialLede } from "./atoms";

/**
 * PublicEditorialHero — the canonical browser-editorial hero pattern.
 *
 * Composes a cinematic image plate with a linen content card. The default
 * fullscreen variant contains the card inside the first viewport; the banner
 * variant lets the card float past the image into the next section.
 *
 * Layout notes:
 * - The card is a sibling of the image plate. Banner positions it absolutely
 *   against the section, with a negative bottom offset to spill into the next
 *   section. Fullscreen keeps it in the section's flow, at the foot of the
 *   first viewport: the section's padding holds it clear of the site header
 *   and off the foot, so on a screen too short for the card (a phone held
 *   sideways) the section grows instead of sliding the card under the header.
 * - All hero text lives *inside* the card on every breakpoint — no body
 *   text directly over imagery (mobile contrast was a design correction).
 * - GEOMETRY SYNC: the boot skeleton in index.html mirrors this component's
 *   rail/gutter/column/card geometry and the banner plate heights in plain
 *   CSS; bootFallbackGeometry.test.ts trips when the class strings here
 *   change — update the skeleton with them.
 *
 * Animation: the panel rises (`editorial-hero-in`) and the kicker /
 * heading / lede / actions stagger in (`editorial-fade-up-1/2/3`). All
 * gated behind `prefers-reduced-motion` — and played on the arrival
 * history entry only. Replaying the entrance on every in-app navigation
 * made the card blink during the `vt-header` shared-element morph: the
 * incoming card sits at opacity 0 through its 280ms animation delay while
 * the browser cross-fades the old hero into it. Later navigations render
 * the card fully composed so the view transition alone carries the motion.
 */
export interface PublicEditorialHeroProps {
  /** Fullscreen home hero or shorter banner hero for sub-pages. */
  variant?: "fullscreen" | "banner";
  /**
   * Drop the shared `view-transition-name: header` morph for this render.
   * Use when another element on the page (e.g. a modal dialog opening over
   * this view) is already morphing — preserving both creates competing
   * transitions and feels jarring.
   */
  disableViewTransition?: boolean;
  /** Primary background image URL. */
  imageSrc: string;
  /** Decorative imagery should pass `""`; otherwise describe the place. */
  imageAlt?: string;
  /** Optional fallback image (e.g. `publicCuration.fallbackImagePaths[0]`). */
  imageFallbackSrc?: string;
  /** Tracked uppercase label above the headline (e.g. `§ 01: Living archive`). */
  kicker?: ReactNode;
  /** Editorial headline (Fraunces). Required. */
  title: ReactNode;
  /** id attached to the heading; pair with `aria-labelledby` on the section. */
  titleId: string;
  /** Restrained body paragraph. Often a short two-sentence lede. */
  lede?: ReactNode;
  /**
   * Optional small-print disclaimer rendered under a hairline rule with a
   * monospaced "note —" prefix. Used by Fund's hero.
   */
  disclaimer?: ReactNode;
  /** Bottom-right caption on the image (place / location credit). */
  photoCredit?: ReactNode;
  /**
   * Slot for primary + secondary actions. Composed by the consuming view
   * because each view's actions wire to different handlers (Install, Link,
   * scroll-to). Pass nothing for read-only heroes (Impact, Actions).
   */
  actions?: ReactNode;
  /**
   * Small tracked-uppercase meta strip rendered at the foot of the card
   * under a hairline — used by Impact for "Season One · Last updated …"
   * publication marks. Style is up to the consumer; a divider is added
   * here for consistent spacing.
   */
  publicationMark?: ReactNode;
}

export function PublicEditorialHero({
  variant = "fullscreen",
  disableViewTransition = false,
  imageSrc,
  imageAlt = "",
  imageFallbackSrc,
  kicker,
  title,
  titleId,
  lede,
  disclaimer,
  photoCredit,
  actions,
  publicationMark,
}: PublicEditorialHeroProps) {
  const isBanner = variant === "banner";
  // React Router keys the very first history entry "default"; every in-app
  // navigation mints a fresh key. Restricting the entrance animation to the
  // arrival entry keeps it render-pure (StrictMode-safe, unlike a module
  // flag) while later view switches paint the card immediately.
  const animateEntrance = useLocation().key === "default";

  return (
    <section
      className={cn(
        !disableViewTransition && "vt-header",
        // z-[1] keeps the banner card painting over the next section, whose
        // `editorial-section-reveal` transform establishes its own stacking
        // context and would otherwise eat the spill.
        "relative isolate z-[1] bg-editorial-deep",
        // Fullscreen: the top padding is the 4rem site header plus the rail's gutter, and
        // the bottom padding is the card's offset from the foot of the first viewport.
        isBanner
          ? "overflow-visible"
          : "flex min-h-screen min-h-[100svh] flex-col justify-end overflow-hidden pt-22 pb-14 sm:pt-26 sm:pb-24 lg:pb-[12svh]"
      )}
      aria-labelledby={titleId}
    >
      <div
        className={cn(
          "overflow-hidden",
          isBanner ? "relative h-[340px] sm:h-[420px] lg:h-[500px]" : "absolute inset-0"
        )}
      >
        <img
          src={imageSrc}
          alt={imageAlt}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            if (imageFallbackSrc && event.currentTarget.src.indexOf(imageFallbackSrc) === -1) {
              event.currentTarget.src = imageFallbackSrc;
            }
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-static-black/55 via-static-black/5 to-static-black/55"
        />
        {photoCredit ? (
          <p className="absolute right-4 top-4 max-w-[60%] text-right text-[10px] font-medium uppercase tracking-[0.16em] text-static-white/72 sm:right-10 lg:right-16">
            {photoCredit}
          </p>
        ) : null}
      </div>

      {/* Content card — hoisted out of the image plate so the banner variant
          can softly overlap the next section: banner positions it against the
          section with a negative bottom to spill into the next block, and
          fullscreen leaves it in the section's flow. */}
      <div
        className={cn(
          "pointer-events-none z-10",
          isBanner ? "absolute inset-x-0 bottom-[-4rem] sm:bottom-[-5rem]" : "relative"
        )}
      >
        <div className="px-6 sm:px-10">
          <div className="mx-auto max-w-7xl">
            <div
              className={cn(
                "pointer-events-auto max-w-[31rem] bg-bg-weak-50 p-6 shadow-[var(--shadow-editorial-panel)] sm:p-8 lg:max-w-[33.5rem] lg:p-10",
                animateEntrance && "editorial-hero-in"
              )}
            >
              {kicker ? (
                <EditorialKicker className={cn(animateEntrance && "editorial-fade-up-1", "mb-3")}>
                  {kicker}
                </EditorialKicker>
              ) : null}
              <EditorialHeading
                id={titleId}
                as="h1"
                size="display"
                className={cn(
                  animateEntrance && "editorial-fade-up-1",
                  !isBanner && "md:text-[3.35rem] lg:text-[4rem]"
                )}
              >
                {title}
              </EditorialHeading>
              {lede ? (
                <div className={cn(animateEntrance && "editorial-fade-up-2", "mt-4 max-w-prose")}>
                  <EditorialLede>{lede}</EditorialLede>
                </div>
              ) : null}
              {actions ? (
                <div
                  className={cn(
                    animateEntrance && "editorial-fade-up-3",
                    "mt-6 flex flex-wrap items-center gap-3"
                  )}
                >
                  {actions}
                </div>
              ) : null}
              {disclaimer ? (
                <div className={cn(animateEntrance && "editorial-fade-up-3", "mt-6")}>
                  <EditorialDivider />
                  <p className="mt-3 font-serif text-xs italic leading-relaxed text-text-soft-400">
                    <span className="mr-1 not-italic font-mono uppercase tracking-[0.16em]">
                      note —
                    </span>
                    {disclaimer}
                  </p>
                </div>
              ) : null}
              {publicationMark ? (
                <div className={cn(animateEntrance && "editorial-fade-up-3", "mt-6")}>
                  <EditorialDivider />
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
                    {publicationMark}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
