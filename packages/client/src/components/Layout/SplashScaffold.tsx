import { APP_NAME, cn } from "@green-goods/shared";
import type React from "react";

/**
 * Ritual surface — the single full-screen login ceremony frame shared by `Splash`
 * and `LoadingSplash`. It owns the root container, the centered constant-height
 * inner block, the logo, the title slot, and EVERY reserved zone wrapper.
 *
 * Both components render through the same reserved skeleton, so their blocks are
 * identical in height. Centering that constant block (`justify-center`) keeps the
 * logo — and the button↔spinner slot — at the EXACT same on-screen Y in every
 * login state AND across the Splash↔LoadingSplash swap. (Anchoring the block top
 * was the old fix for header drift; once the block is constant-height, centering
 * is safe again and reads balanced instead of top-weighted.)
 *
 * The reserve is deliberate: pinning the primary-button Y across states forces the
 * username/callout region to hold space even when empty (create has a username
 * field, returning does not). Centering the whole block distributes the remaining
 * slack so the sparse returning state still reads composed, not top-weighted.
 *
 * Heights use STANDARD Tailwind classes (`h-48`, `h-20`, `h-9`, …), not new
 * arbitrary values: the shared Storybook's Tailwind scan does not reliably
 * generate arbitrary client classes, and the layout-stability CI test runs there.
 */
interface SplashScaffoldProps {
  /** Pulse the logo (loading states). */
  pulse?: boolean;
  /** Title / wordmark line (APP_NAME, or a loading message). */
  title: React.ReactNode;
  /**
   * Username field + info callout. Lives in a fixed-height, overflow-clamped slot
   * so worst-case localized content scrolls inside instead of pushing the primary
   * button down. Reserved (and vertically centered) even when empty.
   */
  content?: React.ReactNode;
  /** Primary + secondary buttons (Splash) or the loading spinner (LoadingSplash). */
  action: React.ReactNode;
  /** Error alert. Reserved fixed-height clamped slot — height-stable for any copy. */
  error?: React.ReactNode;
  /** Small muted note (e.g. address continuity). Reserved height even when empty. */
  notice?: React.ReactNode;
  /** Tertiary text link. Reserved height even when empty. */
  tertiary?: React.ReactNode;
}

export const SplashScaffold: React.FC<SplashScaffoldProps> = ({
  pulse = false,
  title,
  content,
  action,
  error,
  notice,
  tertiary,
}) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-bg-white-0 px-4 py-2">
    <div className="flex w-full max-w-sm flex-col items-center">
      {/* ───────────────────────────────────────────────────────────────────────
          LOGO — wide GG logomark (819×464). Constrain the height and let the
          width follow the aspect ratio (a square box crushes it). Identical
          treatment in both surfaces so the swap never resizes the mark.
      ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 mb-4">
        <img
          src="/icon.png"
          alt={APP_NAME}
          width={819}
          height={464}
          className={cn(
            "h-24 w-auto sm:h-28 transition-opacity duration-[var(--spring-effects-slow-duration)] ease-[var(--spring-effects-slow-easing)]",
            pulse && "animate-pulse"
          )}
        />
      </div>

      {/* TITLE / MESSAGE — fixed-height slot. */}
      <div className="h-8 flex items-center justify-center mb-5">
        <h3 className="text-center font-bold text-primary-dark transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]">
          {title}
        </h3>
      </div>

      {/* CONTENT VIEWPORT — username + callout. Fixed height (h-52 ≈ 208px, sized
          for username + the longest localized callout measured at 375px) + overflow
          clamp: any state's content fits or scrolls INSIDE, so the primary button
          never moves. Content is vertically centered so partial/empty states stay
          balanced rather than top-aligned. */}
      <div
        data-testid="splash-content-viewport"
        className="w-full h-52 mb-4 overflow-y-auto flex flex-col items-center justify-center gap-3"
      >
        {content}
      </div>

      {/* ACTION — primary + secondary buttons (Splash) or the spinner
          (LoadingSplash). Fixed height keeps the slot stable across states. */}
      <div className="w-full flex flex-col items-center gap-3 h-[100px]">{action}</div>

      {/* ERROR — fixed-height clamped slot (height-stable for ANY copy). The
          longest localized error wraps and fits; a much longer one scrolls inside
          instead of pushing the notice + tertiary below it. */}
      <div className="w-full h-20 overflow-y-auto mt-2">{error}</div>

      {/* NOTICE — reserved height so its appearance/disappearance never shifts the
          tertiary or the block height. */}
      <div className="h-9 flex items-center justify-center mt-1">{notice}</div>

      {/* TERTIARY — reserved height. */}
      <div className="h-5 flex items-center justify-center mt-2">{tertiary}</div>
    </div>
  </div>
);
