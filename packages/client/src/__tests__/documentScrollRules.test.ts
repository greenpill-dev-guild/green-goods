/**
 * Ownership contract for the document-level scroll rules.
 *
 * The root element is where the browser and the installed app chain
 * pull-to-refresh, so the document must never contain vertical overscroll on
 * its own. The only owner of that gesture is the modal scroll lock: while
 * useDocumentScrollLock holds `.modal-open`, the sheet or dialog on top owns the
 * document and the gesture stays inert underneath it. This suite pins each rule
 * to its owner so a stray document-wide rule fails here and names the file.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const INDEX_CSS = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const UTILITIES_CSS = readFileSync(resolve(process.cwd(), "src/styles/utilities.css"), "utf8");
const INDEX_HTML = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
const SCROLL_LOCK_SOURCE = readFileSync(
  resolve(process.cwd(), "../shared/src/hooks/ui/useDocumentScrollLock.ts"),
  "utf8"
);

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing ${selector} rule`);
  return match[1];
}

const VERTICAL_OVERSCROLL_BLOCK = /overscroll-behavior(?:-y)?\s*:\s*(?:none|contain)/;

describe("document scroll rules", () => {
  it("leaves vertical overscroll on the root so pull-to-refresh can chain to the browser", () => {
    const html = ruleBody(INDEX_CSS, "html");

    expect(html).toMatch(/overscroll-behavior-x\s*:\s*none/);
    expect(html).not.toMatch(VERTICAL_OVERSCROLL_BLOCK);
  });

  it("keeps the body out of the overscroll decision entirely", () => {
    const body = ruleBody(INDEX_CSS, "body");

    expect(body).toMatch(/position:\s*fixed/);
    expect(body).not.toMatch(/overscroll-behavior/);
  });

  it("keeps the boot shell styles out of the overscroll decision", () => {
    expect(INDEX_HTML).not.toMatch(/overscroll-behavior/);
  });

  it("lets the modal scroll lock own pull-to-refresh while a sheet or dialog holds the document", () => {
    const modalOpen = ruleBody(UTILITIES_CSS, ".modal-open");

    expect(modalOpen).toMatch(/overflow:\s*hidden/);
    expect(modalOpen).toMatch(/overscroll-behavior-y\s*:\s*none/);
    expect(SCROLL_LOCK_SOURCE).toContain('"modal-open"');
  });
});
