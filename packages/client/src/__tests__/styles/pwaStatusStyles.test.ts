import { describe, expect, it } from "vitest";
import {
  pwaStatusStyles,
  type PwaStatusStyle,
  type PwaStatusTone,
} from "../../styles/pwaStatusStyles";

const tones: PwaStatusTone[] = ["primary", "information", "warning", "success", "error", "neutral"];

const requiredSlots: (keyof PwaStatusStyle)[] = [
  "text",
  "icon",
  "surface",
  "border",
  "dot",
  "badge",
  "progress",
  "spinnerBorder",
  "focus",
  "foreground",
];

const primitivePattern =
  /\b(?:accent|bg|border|caret|decoration|divide|fill|from|outline|placeholder|ring|shadow|stroke|text|to|via)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b|duration-\d|duration-\[[^\]]*\d|rgba\(|cubic-bezier\(|#[0-9a-f]/i;

describe("pwaStatusStyles", () => {
  it("defines every Stage 1 status tone with complete slots", () => {
    expect(Object.keys(pwaStatusStyles).sort()).toEqual([...tones].sort());

    for (const tone of tones) {
      for (const slot of requiredSlots) {
        expect(pwaStatusStyles[tone][slot], `${tone}.${slot}`).toBeTruthy();
      }
    }
  });

  it("uses Warm Earth token-backed classes rather than primitive palette or raw motion values", () => {
    for (const [tone, styles] of Object.entries(pwaStatusStyles)) {
      for (const [slot, value] of Object.entries(styles)) {
        expect(value, `${tone}.${slot}`).not.toMatch(primitivePattern);
      }
    }
  });
});
