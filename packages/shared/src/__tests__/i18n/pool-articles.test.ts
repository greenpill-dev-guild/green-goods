import { describe, expect, it } from "vitest";

import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

/**
 * PRD-772 — the article preceding "pool" was wrong in both Spanish and
 * Portuguese. The reporter (a native Portuguese speaker) named the approved
 * forms: "la pool" in Spanish, "a piscina" in Portuguese.
 *
 * These strings have been reverted once already by an automated review pass,
 * so they are pinned here: changing them should be a deliberate decision with
 * the reporter, not a silent edit.
 */
describe("i18n pool articles (PRD-772)", () => {
  const key = "cockpit.community.coordination.status";

  it("uses the feminine article in Spanish", () => {
    expect((es as Record<string, string>)[key]).toBe("Estado de la pool");
  });

  it("uses the feminine article in Portuguese", () => {
    expect((pt as Record<string, string>)[key]).toBe("Status da piscina");
  });
});
