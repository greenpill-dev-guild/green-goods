import { APP_NAME, cn } from "@green-goods/shared";
import type React from "react";

/**
 * Ritual surface — the single full-screen login ceremony frame shared by `Splash`
 * and `LoadingSplash`. It owns the root container, the golden-anchored constant-
 * height block, the logo, the title slot, and EVERY reserved zone wrapper.
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
 * Vertical anchor: the two flexGrow spacers split the free space 7:3, landing
 * the logo center near the golden section at the EXACT same Y in every state —
 * the LayoutStability storybook-ci test pins the logo, both slot zones, the
 * input (across form panels), the primary (within each cluster), and the
 * tertiary link. The spacers use inline flexGrow (nothing for a Tailwind
 * content scan to miss); zone heights are STANDARD classes (`h-11`, `h-20`,
 * `h-8`, `h-5`), which the shared Storybook scan generates (storybook.css
 * declares `@source "../../client/src"`).
 */
interface SplashScaffoldProps {
  /** Pulse the logo (loading states). */
  pulse?: boolean;
  /** Title / wordmark line (APP_NAME, or a loading message). */
  title: React.ReactNode;
  /** Slot 1 — entry primary, or the form input, or the boot spinner. */
  slotOne?: React.ReactNode;
  /** Slot 2 — entry secondary, or the form primary. Reserved when empty. */
  slotTwo?: React.ReactNode;
  /**
   * Message zone — error XOR info/helper for the active state. Fixed-height,
   * overflow-clamped, `relative` so the always-mounted (visibility-toggled)
   * error node can overlay without displacing the info node.
   */
  message?: React.ReactNode;
  /** Tertiary text link. Reserved height even when empty. */
  tertiary?: React.ReactNode;
}

const SLOT_CLASS = "w-full h-11 flex items-center justify-center";

export const SplashScaffold: React.FC<SplashScaffoldProps> = ({
  pulse = false,
  title,
  slotOne,
  slotTwo,
  message,
  tertiary,
}) => (
  <div className="min-h-screen flex flex-col items-center bg-bg-white-0 px-4 py-2">
    {/* Golden anchor — free space splits 7:3 above/below the constant block. */}
    <div aria-hidden="true" style={{ flexGrow: 7 }} />

    <div className="flex w-full max-w-sm flex-col items-center">
      {/* ───────────────────────────────────────────────────────────────────────
          LOGO — wide GG logomark (819×464). Constrain the height and let the
          width follow the aspect ratio (a square box crushes it). Identical
          treatment in every state so swaps never resize the mark.
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

    <div aria-hidden="true" style={{ flexGrow: 3 }} />
  </div>
);
