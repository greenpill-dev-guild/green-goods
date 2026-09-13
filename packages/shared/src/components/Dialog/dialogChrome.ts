import type { CSSProperties } from "react";
import { useMediaQuery } from "../../hooks/ui/useMediaQuery";
import { PWA_SHEET_MEDIA_QUERY } from "./PwaSheet";

export const dialogOverlayClassName = "fixed inset-0 z-overlay";

export const dialogOverlayStyle = {
  backgroundColor: "var(--color-scrim)",
} satisfies CSSProperties;

export const dialogSurfaceStyle = {
  paddingBottom: "env(safe-area-inset-bottom)",
} satisfies CSSProperties;

/**
 * Below `PWA_SHEET_MEDIA_QUERY` every shared dialog renders the PwaSheet
 * bottom sheet (portaled to `document.body`, like the Radix surface); the
 * centered Radix surface only mounts at 640px and wider.
 */
export function useRendersAsSheet(): boolean {
  const isNarrow = useMediaQuery(PWA_SHEET_MEDIA_QUERY);
  return isNarrow && typeof document !== "undefined";
}
