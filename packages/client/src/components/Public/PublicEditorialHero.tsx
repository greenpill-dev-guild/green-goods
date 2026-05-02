import type { ReactNode } from "react";
import { cn } from "@green-goods/shared";
import { EditorialDivider, EditorialHeading, EditorialKicker, EditorialLede } from "./atoms";

/**
 * PublicEditorialHero — the canonical browser-editorial hero pattern.
 *
 * Composes a cinematic image plate with a linen content card. The default
 * fullscreen variant contains the card inside the first viewport; the banner
 * variant lets the card float past the image into the next section.
 *
 * Layout notes:
 * - The card is a sibling of the image plate, positioned absolutely against
 *   the section. Banner uses a negative bottom offset to spill into the next
 *   section; fullscreen sits the card inside the first viewport.
 * - All hero text lives *inside* the card on every breakpoint — no body
 *   text directly over imagery (mobile contrast was a design correction).
 *
 * Animation: the panel rises (`editorial-hero-in`) and the kicker /
 * heading / lede / actions stagger in (`editorial-fade-up-1/2/3`). All
 * gated behind `prefers-reduced-motion`.
 */
export interface PublicEditorialHeroProps {
  /** Fullscreen home hero or shorter banner hero for sub-pages. */
  variant?: "fullscreen" | "banner";
  /** Primary background image URL. */
  imageSrc: string;
  /** Decorative imagery should pass `""`; otherwise describe the place. */
  imageAlt?: string;
  /** Optional fallback image (e.g. `publicCuration.fallbackImagePaths[0]`). */
  imageFallbackSrc?: string;
  /** Tracked uppercase label above the headline (e.g. `Living Archive`). */
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

  return (
    <section
      className={cn(
        "relative isolate bg-editorial-deep",
        isBanner ? "overflow-visible" : "min-h-screen min-h-[100svh] overflow-hidden"
      )}
      aria-labelledby={titleId}
    >
      <div
        className={cn(
          "relative overflow-hidden",
          isBanner ? "h-[340px] sm:h-[420px] lg:h-[500px]" : "min-h-screen min-h-[100svh]"
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
          can softly overlap the next section. Positioned relative to the
          section so banner uses negative bottom to spill into the next block. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 z-10",
          isBanner ? "bottom-[-4rem] sm:bottom-[-5rem]" : "bottom-14 sm:bottom-24 lg:bottom-[12svh]"
        )}
      >
        <div className="px-6 sm:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="editorial-hero-in pointer-events-auto max-w-[31rem] bg-bg-weak-50 p-6 shadow-[var(--shadow-editorial-panel)] sm:p-8 lg:max-w-[33.5rem] lg:p-10">
              {kicker ? (
                <EditorialKicker className="editorial-fade-up-1 mb-3">{kicker}</EditorialKicker>
              ) : null}
              <EditorialHeading
                id={titleId}
                as="h1"
                size="display"
                className={cn(
                  "editorial-fade-up-1",
                  !isBanner && "md:text-[3.35rem] lg:text-[4rem]"
                )}
              >
                {title}
              </EditorialHeading>
              {lede ? (
                <div className="editorial-fade-up-2 mt-4 max-w-prose">
                  <EditorialLede>{lede}</EditorialLede>
                </div>
              ) : null}
              {actions ? (
                <div className="editorial-fade-up-3 mt-6 flex flex-wrap items-center gap-3">
                  {actions}
                </div>
              ) : null}
              {disclaimer ? (
                <div className="editorial-fade-up-3 mt-6">
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
                <div className="editorial-fade-up-3 mt-6">
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
