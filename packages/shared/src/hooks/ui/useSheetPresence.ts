import { useEffect } from "react";
import { useUIStore } from "../../stores/useUIStore";

/**
 * Registers a sheet or dialog with the UI store while `open` is true.
 *
 * App chrome that must step aside for any overlay (the installed PWA's
 * AppBar) reads the store's reference count instead of a hand-maintained
 * list of sheets, so a new sheet hides the bar without extra wiring
 * (DL-015). Registration is released on close and on unmount, and stays
 * balanced across React StrictMode's double effects.
 */
export function useSheetPresence(open: boolean): void {
  const registerOpenSheet = useUIStore((state) => state.registerOpenSheet);

  useEffect(() => {
    if (!open) return;
    return registerOpenSheet();
  }, [open, registerOpenSheet]);
}
