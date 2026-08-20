import { describe, expect, it } from "vitest";

import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

/**
 * PRD-772 — the article preceding "pool" in the coordination status string.
 *
 * The issue records the QA reporter's expected forms as "la pool" and
 * "a piscina". Only the Spanish half was adopted: a native Portuguese speaker
 * reviewing the fix kept "pool" as the domain term in Portuguese rather than
 * translating it to "piscina", and that reading is authoritative here.
 *
 * These two strings have already been changed back and forth once, so they are
 * pinned. If you arrived here from the Linear issue and are about to "fix" the
 * Portuguese to "piscina", that is the loop this test exists to stop — take it
 * up with the reviewer first.
 */
describe("i18n pool articles (PRD-772)", () => {
  const key = "cockpit.community.coordination.status";

  it("uses the feminine article in Spanish", () => {
    expect((es as Record<string, string>)[key]).toBe("Estado de la pool");
  });

  it("keeps the untranslated domain term in Portuguese", () => {
    expect((pt as Record<string, string>)[key]).toBe("Status do pool");
  });
});
