/**
 * Focus Trap Hook
 *
 * Traps keyboard focus within a container element (Tab/Shift+Tab cycling)
 * and optionally auto-focuses a target element on mount.
 *
 * @module hooks/utils/useFocusTrap
 */

import { useEffect, type RefObject } from "react";

// The trap's companion: hand focus back to the opener when the surface closes. It is exported
// from this declared leaf so a consuming package needs no new entry in the package manifest.
export { useOpenerFocus } from "./useOpenerFocus";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

interface UseFocusTrapOptions {
  /** Whether the trap is active (default: true) */
  enabled?: boolean;
  /** Selector for the element to auto-focus on mount (default: '[data-testid="modal-drawer-close"]') */
  autoFocusSelector?: string | null;
}

/**
 * Traps Tab/Shift+Tab focus cycling within a dialog element.
 * Auto-focuses a target element when the trap activates.
 *
 * @param ref - Ref to the container element
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const dialogRef = useRef<HTMLDivElement>(null);
 * useFocusTrap(dialogRef);
 * // or with options:
 * useFocusTrap(dialogRef, { enabled: isOpen, autoFocusSelector: "#my-button" });
 * ```
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions = {}
): void {
  const { enabled = true, autoFocusSelector = '[data-testid="modal-drawer-close"]' } = options;

  useEffect(() => {
    if (!enabled) return;
    const container = ref.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      // The button/input/textarea/select/anchor clauses match natively focusable
      // elements regardless of an explicit tabindex="-1", so a scrim like
      // `<button tabIndex={-1}>` would slip in as a tab stop. Drop anything the
      // author removed from the tab order so wrap targets stay real.
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => {
        if (el.tabIndex < 0 || el.matches(":disabled, [type='hidden']")) return false;
        for (let node: HTMLElement | null = el; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (
            node.hidden ||
            node.inert ||
            style.display === "none" ||
            style.visibility === "hidden"
          )
            return false;
          if (node === container) break;
        }
        return true;
      });
      if (focusable.length === 0) return;

      // Safari can skip buttons in its native Tab order, including a photo just restored
      // by a nested viewer. Own every step instead of relying on native movement between
      // the boundaries, so it cannot jump to the page or browser chrome.
      const current = focusable.indexOf(document.activeElement as HTMLElement);
      const next =
        current < 0
          ? e.shiftKey
            ? focusable.length - 1
            : 0
          : (current + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      e.preventDefault();
      focusable[next].focus();
    };

    container.addEventListener("keydown", handleKeyDown);

    // Auto-focus target element for keyboard users
    const target = autoFocusSelector
      ? container.querySelector<HTMLElement>(autoFocusSelector)
      : null;
    target?.focus();

    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [ref, enabled, autoFocusSelector]);
}
