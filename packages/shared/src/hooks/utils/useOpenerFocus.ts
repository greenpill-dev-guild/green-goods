/**
 * Opener Focus Hook
 *
 * Hands focus back to whatever opened a dialog surface that is shown by state:
 * a sheet, or a Radix dialog rendered without a `Dialog.Trigger`, which Radix
 * leaves with nothing to return focus to.
 *
 * @module hooks/utils/useOpenerFocus
 */

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Remembers the focused element when the surface opens and focuses it again
 * when the surface closes or unmounts.
 *
 * The capture is a layout effect so it runs before a focus trap moves focus
 * into the surface; the restore is a passive cleanup because React DOM
 * re-focuses the pre-commit element after its mutation phase, which would undo
 * a restore made during layout.
 *
 * @param open - Whether the surface is showing
 */
export function useOpenerFocus(open: boolean): void {
  const openerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return () => {
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);
}
