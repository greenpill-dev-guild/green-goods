import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";
import { formatCommitmentUnits } from "../../i18n/commitmentUnits";

const locales = [
  {
    locale: "en",
    messages: en,
    units: [
      ["sessions", "1 session", "2 sessions"],
      ["repairs", "1 repair", "2 repairs"],
      ["rides", "1 ride", "2 rides"],
    ],
  },
  {
    locale: "es",
    messages: es,
    units: [
      ["sessions", "1 sesión", "2 sesiones"],
      ["repairs", "1 reparación", "2 reparaciones"],
      ["rides", "1 viaje", "2 viajes"],
    ],
  },
  {
    locale: "pt",
    messages: pt,
    units: [
      ["sessions", "1 sessão", "2 sessões"],
      ["repairs", "1 conserto", "2 consertos"],
      ["rides", "1 carona", "2 caronas"],
    ],
  },
] as const;

describe("formatCommitmentUnits", () => {
  it.each(locales)("uses $locale plural forms for session, repair, and ride units", (locale) => {
    const intl = createIntl({ locale: locale.locale, messages: locale.messages });

    for (const [unit, singular, plural] of locale.units) {
      expect(formatCommitmentUnits(intl, 1n, unit)).toBe(singular);
      expect(formatCommitmentUnits(intl, 2n, unit)).toBe(plural);
    }
  });

  it("recognizes localized composer labels and preserves garden-authored units", () => {
    const intl = createIntl({ locale: "pt", messages: pt });

    expect(formatCommitmentUnits(intl, 1n, "sessões")).toBe("1 sessão");
    expect(formatCommitmentUnits(intl, 1n, "trees")).toBe("1 trees");
  });
});
