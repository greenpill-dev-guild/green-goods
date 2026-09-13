import { describe, expect, it } from "vitest";
import {
  parsePwaCssDurationToMs,
  PWA_SHEET_CLOSE_DURATION_VAR,
  pwaSheetStyles,
  type PwaSheetStyle,
} from "../../components/Pwa/sheetStyles";

const requiredSlots: (keyof PwaSheetStyle)[] = [
  "overlay",
  "dialogOverlay",
  "overlayTransition",
  "panel",
  "dialogSurface",
  "header",
  "tabs",
  "tabTrigger",
  "tabActive",
  "tabInactive",
  "tabBadge",
  "tabIndicator",
  "closeButtonBase",
  "closeIcon",
  "workFeedbackSheet",
  "workActionBar",
  "workActionBarStandalone",
  "workCloseButton",
];

const primitivePattern =
  /\b(?:accent|bg|border|caret|decoration|divide|fill|from|outline|placeholder|ring|shadow|stroke|text|to|via)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b|duration-\d|duration-\[[^\]]*\d|rgba\(|cubic-bezier\(|#[0-9a-f]/i;

describe("pwaSheetStyles", () => {
  it("defines complete Stage 2 sheet style slots", () => {
    for (const slot of requiredSlots) {
      expect(pwaSheetStyles[slot], slot).toBeTruthy();
    }
  });

  it("uses Warm Earth token-backed classes rather than primitive palette or raw motion values", () => {
    for (const [slot, value] of Object.entries(pwaSheetStyles)) {
      expect(value, slot).not.toMatch(primitivePattern);
    }
  });

  it("uses the PWA scrim token for modal backdrops", () => {
    expect(pwaSheetStyles.overlay).toContain("bg-[var(--color-scrim)]");
    expect(pwaSheetStyles.dialogOverlay).toContain("bg-[var(--color-scrim)]");
    expect(pwaSheetStyles.overlay).not.toContain("--color-overlay");
    expect(pwaSheetStyles.dialogOverlay).not.toContain("--color-overlay");
  });

  it("keeps close timing tied to the spring token contract", () => {
    expect(PWA_SHEET_CLOSE_DURATION_VAR).toBe("--spring-spatial-duration");
    expect(parsePwaCssDurationToMs("300ms")).toBe(300);
    expect(parsePwaCssDurationToMs("0.3s")).toBe(300);
    expect(parsePwaCssDurationToMs("")).toBe(0);
  });

  it("keeps the open feedback sheet and action bar on one continuous surface", () => {
    expect(pwaSheetStyles.workFeedbackSheet).toContain("rounded-t-[var(--radius-lg)]");
    expect(pwaSheetStyles.workFeedbackSheet).toContain("border-b-0");
    expect(pwaSheetStyles.workActionBar).not.toContain("rounded-t-");
    expect(pwaSheetStyles.workActionBar).not.toContain("border-t");
    expect(pwaSheetStyles.workActionBar).not.toContain("shadow-");
    expect(pwaSheetStyles.workActionBarStandalone).toContain("rounded-t-[var(--radius-lg)]");
  });
});
