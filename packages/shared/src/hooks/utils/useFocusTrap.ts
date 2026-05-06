/**
 * Focus Trap Hook
 *
 * Traps keyboard focus within a container element (Tab/Shift+Tab cycling)
 * and optionally auto-focuses a target element on mount.
 *
 * @module hooks/utils/useFocusTrap
 */

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

interface UseFocusTrapOptions {
  /** Whether the trap is active (default: true) */
  enabled?: boolean;
  /** Selector for the element to auto-focus on mount (default: '[data-testid="modal-drawer-close"]') */
  autoFocusSelector?: string;
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

      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    // Auto-focus target element for keyboard users
    const target = container.querySelector<HTMLElement>(autoFocusSelector);
    target?.focus();

    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [ref, enabled, autoFocusSelector]);
}
