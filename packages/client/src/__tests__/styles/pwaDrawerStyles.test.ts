import { describe, expect, it } from "vitest";
import {
  parsePwaCssDurationToMs,
  PWA_DRAWER_CLOSE_DURATION_VAR,
  pwaDrawerStyles,
  type PwaDrawerStyle,
} from "../../styles/pwaDrawerStyles";

const requiredSlots: (keyof PwaDrawerStyle)[] = [
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
  "footer",
  "closeButtonBase",
  "closeIcon",
  "workFeedbackDrawer",
  "workActionBar",
  "workCloseButton",
];

const primitivePattern =
  /\b(?:accent|bg|border|caret|decoration|divide|fill|from|outline|placeholder|ring|shadow|stroke|text|to|via)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b|duration-\d|duration-\[[^\]]*\d|rgba\(|cubic-bezier\(|#[0-9a-f]/i;

describe("pwaDrawerStyles", () => {
  it("defines complete Stage 2 drawer style slots", () => {
    for (const slot of requiredSlots) {
      expect(pwaDrawerStyles[slot], slot).toBeTruthy();
    }
  });

  it("uses Warm Earth token-backed classes rather than primitive palette or raw motion values", () => {
    for (const [slot, value] of Object.entries(pwaDrawerStyles)) {
      expect(value, slot).not.toMatch(primitivePattern);
    }
  });

  it("uses the PWA scrim token for modal backdrops", () => {
    expect(pwaDrawerStyles.overlay).toContain("bg-[var(--color-scrim)]");
    expect(pwaDrawerStyles.dialogOverlay).toContain("bg-[var(--color-scrim)]");
    expect(pwaDrawerStyles.overlay).not.toContain("--color-overlay");
    expect(pwaDrawerStyles.dialogOverlay).not.toContain("--color-overlay");
  });

  it("keeps close timing tied to the spring token contract", () => {
    expect(PWA_DRAWER_CLOSE_DURATION_VAR).toBe("--spring-spatial-duration");
    expect(parsePwaCssDurationToMs("300ms")).toBe(300);
    expect(parsePwaCssDurationToMs("0.3s")).toBe(300);
    expect(parsePwaCssDurationToMs("")).toBe(0);
  });
});
