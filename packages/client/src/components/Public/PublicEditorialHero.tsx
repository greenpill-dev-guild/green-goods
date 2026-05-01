import type { ReactNode } from "react";
import { EditorialDivider, EditorialHeading, EditorialKicker, EditorialLede } from "./atoms";

/**
 * PublicEditorialHero — the canonical browser-editorial hero pattern.
 *
 * Composes a cinematic image plate + an overlapping linen card. The card
 * sits absolutely at the bottom of the image and extends *below* the hero
 * section into the next section, which is the editorial dialect's
 * signature gesture (the gardens/impact/fund/actions hero variants all use
 * this same overlap).
 *
 * Layout notes:
 * - The hero `<section>` uses `overflow-visible` so the card can protrude.
 * - The next section the consumer renders should reserve `pt-32 md:pt-48`
 *   (≈ matches the negative `bottom` offset on the card) to avoid the
 *   following content colliding with the card.
 * - All hero text lives *inside* the card on every breakpoint — no body
 *   text directly over imagery (mobile contrast was a design correction).
 *
 * Animation: the panel rises (`editorial-hero-in`) and the kicker /
 * heading / lede / actions stagger in (`editorial-fade-up-1/2/3`). All
 * gated behind `prefers-reduced-motion`.
 */
export interface PublicEditorialHeroProps {
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
  return (
    <section
      className="relative isolate overflow-visible bg-editorial-deep"
      aria-labelledby={titleId}
    >
      <div className="relative h-[460px] overflow-hidden sm:h-[560px] md:h-[680px] lg:h-[780px]">
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
          className="absolute inset-0 bg-gradient-to-b from-static-black/15 via-static-black/0 to-static-black/55"
        />
        {photoCredit ? (
          <p className="absolute right-4 bottom-7 max-w-[60%] text-right text-[10px] font-medium uppercase tracking-[0.16em] text-static-white/72 sm:right-10 lg:right-16">
            {photoCredit}
          </p>
        ) : null}
      </div>

      <div className="pointer-events-none absolute right-4 bottom-[-100px] left-4 z-10 sm:right-auto sm:bottom-[-120px] sm:left-10 sm:max-w-[34rem] lg:bottom-[-150px] lg:left-24 lg:max-w-[40rem]">
        <div className="editorial-hero-in pointer-events-auto bg-bg-weak-50 p-7 shadow-[0_30px_80px_-30px_rgba(28,25,23,0.35)] sm:p-10 lg:p-14">
          {kicker ? (
            <EditorialKicker className="editorial-fade-up-1 mb-4">{kicker}</EditorialKicker>
          ) : null}
          <EditorialHeading id={titleId} as="h1" size="display" className="editorial-fade-up-1">
            {title}
          </EditorialHeading>
          {lede ? (
            <div className="editorial-fade-up-2 mt-5 max-w-prose">
              <EditorialLede>{lede}</EditorialLede>
            </div>
          ) : null}
          {actions ? (
            <div className="editorial-fade-up-3 mt-7 flex flex-wrap items-center gap-3">
              {actions}
            </div>
          ) : null}
          {disclaimer ? (
            <div className="editorial-fade-up-3 mt-7">
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
            <div className="editorial-fade-up-3 mt-7">
              <EditorialDivider />
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
                {publicationMark}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
