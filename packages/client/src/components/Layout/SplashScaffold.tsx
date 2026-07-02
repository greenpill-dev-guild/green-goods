import { APP_NAME, cn } from "@green-goods/shared";
import type React from "react";

/**
 * Ritual surface — the single full-screen login ceremony frame shared by `Splash`
 * and `LoadingSplash`. It owns the root container, the golden-anchored constant-
 * height block, the logo, the title slot, and EVERY reserved zone wrapper.
 *
 * Slot model: every auth state renders the same skeleton —
 *   logo · title · slot A (input) · slot B (primary) · slot C (secondary) ·
 *   message zone · tertiary
 * Slots A/B/C share one height (h-11 = the md button height), so any state can
 * fill or leave any of them empty without the block ever changing height. The
 * message zone is ONE fixed-height clamped region (replacing the old callout,
 * error, and notice zones): the worst-case localized string fits, and anything
 * longer scrolls INSIDE instead of pushing the tertiary link down.
 *
 * Vertical anchor: the two flexGrow spacers split the free space 7:3, landing
 * the logo center near the golden section (~38% of an 812px viewport) at the
 * EXACT same Y in every state — the LayoutStability storybook-ci test pins the
 * logo, slot B, the username input, and the tertiary link across states. The
 * spacers use inline flexGrow (nothing for a Tailwind content scan to miss);
 * zone heights are STANDARD classes (`h-11`, `h-20`, `h-8`, `h-5`), which the
 * shared Storybook scan generates (storybook.css declares
 * `@source "../../client/src"`).
 */
interface SplashScaffoldProps {
  /** Pulse the logo (loading states). */
  pulse?: boolean;
  /** Title / wordmark line (APP_NAME, or a loading message). */
  title: React.ReactNode;
  /** Slot A — username input. Reserved (empty) when a state collects nothing. */
  slotA?: React.ReactNode;
  /** Slot B — primary action (button, or the boot spinner). The pinned anchor. */
  slotB?: React.ReactNode;
  /** Slot C — secondary action. Reserved (empty) when a state offers none. */
  slotC?: React.ReactNode;
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
  slotA,
  slotB,
  slotC,
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

      {/* SLOT STACK — equal-height slots + message zone + tertiary. Every zone
          is reserved in every state; emptiness is expressed by content, never
          by layout. */}
      <div className="w-full flex flex-col items-center gap-3">
        <div data-testid="splash-slot-input" className={SLOT_CLASS}>
          {slotA}
        </div>
        <div data-testid="action-slot-primary" className={SLOT_CLASS}>
          {slotB}
        </div>
        <div data-testid="splash-slot-secondary" className={SLOT_CLASS}>
          {slotC}
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
