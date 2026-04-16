import { useMemo } from "react";
import { useContainerQuery } from "./useContainerQuery";

/**
 * Computes responsive sheet width based on canvas container width.
 * Replaces duplicated `desktopSheetWidth` calculations in view files.
 */
export function useSheetWidth() {
  const { ref, width } = useContainerQuery<HTMLDivElement>(600);

  const sheetWidth = useMemo(() => {
    if (width === 0) return 560; // SSR fallback
    return Math.min(Math.max(440, width * 0.38), 660);
  }, [width]);

  const isDesktop = width >= 600;

  return { containerRef: ref, sheetWidth, isDesktop };
}
