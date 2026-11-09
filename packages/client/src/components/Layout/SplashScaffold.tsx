import { APP_NAME } from "@green-goods/shared/config/app";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type FC, type ReactNode, useLayoutEffect, useRef } from "react";

/**
 * Ritual surface — the full-screen login ceremony frame used after boot has
 * resolved. It owns the root container, the shared, constant-height
 * block, the logo, the title slot, and EVERY reserved zone wrapper.
 *
 * Slot model: every auth state renders the same skeleton —
 *   logo · title · slot 1 · slot 2 · message zone · tertiary
 * The two control slots share one height (h-11 = the md button height) and are
 * polymorphic by SCREEN, not by state: entry screens put the primary in slot 1
 * and the secondary in slot 2; form screens put the input in slot 1 and the
 * primary in slot 2. The slots themselves never move — the primary changes slot
 * only on user-initiated navigation (entry → form), never during async swaps
 * (error, loading, first-time↔returning detection).
 *
 * The message zone is ONE fixed-height clamped region: the worst-case localized
 * string fits, and anything longer scrolls INSIDE instead of pushing the
 * tertiary link down.
 *
 * Vertical anchor: the two flexGrow spacers split the free space 11:9, keeping
 * the block higher while the logo has the EXACT same Y in every state —
 * the LayoutStability storybook-ci test pins the logo, both slot zones, the
 * input (across form panels), the primary (within each cluster), and the
 * tertiary link. The spacers use inline flexGrow (nothing for a Tailwind
 * content scan to miss); zone heights are STANDARD classes (`h-11`, `h-20`,
 * `h-8`, `h-5`), which the shared Storybook scan generates (storybook.css
 * declares `@source "../../client/src"`).
 *
 * One geometry for every screen that draws the logo: sign-in in all its states,
 * the app's own loading screen, and the screen shown when the app could not
 * open. GEOMETRY SYNC: the loading screen is static HTML that paints before
 * this file loads (`.boot-pwa-shell` in index.html) and mirrors this scaffold
 * slot for slot; bootFallbackGeometry.test.ts fails when either side changes, so
 * update both together. A screen with one action may put a quiet note in slot
 * two, aligned to the slot's top.
 *
 * The split is taken inside the safe area (DL-170): the frame pads by the
 * status bar's inset at the top and by --safe-area-bottom at the bottom. Chrome
 * on Android draws an installed app under the system bars only once a page
 * asks for it, so a reload lays the page out between the bars first and under
 * them a few frames later; padding by the insets keeps the logo at one place on
 * the screen in both.
 */
interface SplashScaffoldProps {
  /**
   * Breathe the logo (loading states): the shared logo-screen motion in
   * styles/logo-screens.css, started on the page's clock like the loading
   * screen's.
   */
  breathe?: boolean;
  /** Title / wordmark line (APP_NAME, or a loading message). */
  title: ReactNode;
  /**
   * How the line reads. The app's name keeps the wordmark's voice; a sentence
   * ("Signing you in...", "Green Goods couldn't open.") takes the loading
   * screen's. Both sit centred in the same slot, so the line never moves.
   */
  titleVoice?: "name" | "status";
  /** Slot 1 — entry primary or the form input. */
  slotOne?: ReactNode;
  /** Slot 2 — entry secondary, or the form primary. Reserved when empty. */
  slotTwo?: ReactNode;
  /**
   * Message zone — error XOR info/helper for the active state. Fixed-height,
   * overflow-clamped, `relative` so the always-mounted (visibility-toggled)
   * error node can overlay without displacing the info node.
   */
  message?: ReactNode;
  /** Tertiary text link. Reserved height even when empty. */
  tertiary?: ReactNode;
}

const SLOT_CLASS = "w-full h-11 flex items-center justify-center";

/** One breath of the logo, in ms: `.logo-breathe` here and `boot-breathe` in index.html. */
const BREATHE_MS = 2400;

export const SplashScaffold: FC<SplashScaffoldProps> = ({
  breathe = false,
  title,
  titleVoice = "name",
  slotOne,
  slotTwo,
  message,
  tertiary,
}) => {
  const logoRef = useRef<HTMLImageElement>(null);

  // A breath starts on the page's clock, as the loading screen's does, so a
  // hand-over from one to the other never restarts it.
  useLayoutEffect(() => {
    if (breathe && logoRef.current) {
      logoRef.current.style.animationDelay = `${-(performance.now() % BREATHE_MS)}ms`;
    }
  }, [breathe]);

  return (
    <div className="min-h-screen flex flex-col items-center bg-bg-canvas px-4 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] pb-[calc(0.5rem+var(--safe-area-bottom))]">
      {/* Shared anchor — free space splits 11:9 above/below the constant block. */}
      {/* The upper spacer's 45% remainder lowers the block by 4px. */}
      <div aria-hidden="true" style={{ flexGrow: 11, flexBasis: "calc(4px * 20 / 9)" }} />

      <div className="flex w-full max-w-sm flex-col items-center">
        {/* ───────────────────────────────────────────────────────────────────────
          LOGO — wide GG logomark (819×464). Constrain the height and let the
          width follow the aspect ratio (a square box crushes it). Identical
          treatment in every state so swaps never resize the mark.
      ─────────────────────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 mb-4">
          <img
            ref={logoRef}
            src="/icon.png"
            alt={APP_NAME}
            width={819}
            height={464}
            className={cn(
              "h-24 w-auto sm:h-28 transition-opacity duration-[var(--spring-effects-slow-duration)] ease-[var(--spring-effects-slow-easing)]",
              breathe && "logo-breathe"
            )}
          />
        </div>

        {/* TITLE / MESSAGE — fixed-height slot. */}
        <div className="h-8 flex items-center justify-center mb-5">
          <h3
            className={cn(
              "text-center transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
              titleVoice === "name"
                ? "text-[1.25rem] font-bold text-primary-on-surface"
                : "text-base font-[650] text-text-strong-950"
            )}
          >
            {title}
          </h3>
        </div>

        {/* SLOT STACK — two equal-height control slots + message zone + tertiary.
          Every zone is reserved in every state; emptiness is expressed by
          content, never by layout. */}
        <div className="w-full flex flex-col items-center gap-3">
          <div data-testid="splash-slot-one" className={SLOT_CLASS}>
            {slotOne}
          </div>
          <div data-testid="splash-slot-two" className={SLOT_CLASS}>
            {slotTwo}
          </div>
          <div data-testid="splash-message-zone" className="relative w-full h-20 overflow-y-auto">
            {message}
          </div>
          <div className="h-5 flex items-center justify-center">{tertiary}</div>
        </div>
      </div>

      <div aria-hidden="true" style={{ flexGrow: 9 }} />
    </div>
  );
};
