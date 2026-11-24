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

/** The body of the first `@media <query>` block, braces balanced. */
function mediaBlock(css: string, query: string): string {
  const open = css.indexOf("{", css.indexOf(`@media ${query} {`));
  if (!css.includes(`@media ${query} {`)) throw new Error(`Missing @media ${query} block`);
  let depth = 0;
  for (let index = open; index < css.length; index++) {
    if (css[index] === "{") depth++;
    if (css[index] === "}" && --depth === 0) return css.slice(open + 1, index);
  }
  throw new Error(`Unclosed @media ${query} block`);
}

const VERTICAL_OVERSCROLL_BLOCK = /overscroll-behavior(?:-y)?\s*:\s*(?:none|contain)/;

describe("document scroll rules", () => {
  it("leaves vertical overscroll on the root so pull-to-refresh can chain to the browser", () => {
    const html = ruleBody(INDEX_CSS, "html");

    expect(html).toMatch(/overscroll-behavior-x\s*:\s*none/);
    expect(html).not.toMatch(VERTICAL_OVERSCROLL_BLOCK);
  });

  it("floors the installed app's page at the screen so iOS 26 gives it the whole viewport", () => {
    // iOS 26 lays out a see-through status bar install a status bar short while the page is
    // shorter than the screen. The floor stays in the installed app: in a browser tab 100lvh
    // is taller than what is on screen, and the page would scroll under the toolbar.
    const floor = ruleBody(mediaBlock(INDEX_CSS, "(display-mode: standalone)"), "html");

    expect(floor).toMatch(
      /min-height:\s*min\(100lvh,\s*calc\(100%\s*\+\s*env\(safe-area-inset-top,\s*0px\)\)\)/
    );
    expect(ruleBody(INDEX_CSS, "html")).not.toMatch(/min-height/);
  });

  it("keeps the body out of the overscroll decision entirely", () => {
    const body = ruleBody(INDEX_CSS, "body");

    expect(body).not.toMatch(/position:\s*fixed|overflow-hidden|overflow:\s*hidden/);
    expect(body).not.toMatch(/overscroll-behavior/);
  });

  it("keeps the boot shell styles out of the overscroll decision", () => {
    expect(INDEX_HTML).not.toMatch(/overscroll-behavior/);
    expect(INDEX_HTML).not.toMatch(
      /html\[data-boot-presentation="pwa"\] body\s*\{[^}]*overflow:\s*hidden/s
    );
  });

  it("lets the modal scroll lock own pull-to-refresh while a sheet or dialog holds the document", () => {
    const modalOpen = ruleBody(UTILITIES_CSS, ".modal-open");

    expect(modalOpen).toMatch(/overflow:\s*hidden/);
    expect(modalOpen).toMatch(/overscroll-behavior-y\s*:\s*none/);
    expect(SCROLL_LOCK_SOURCE).toContain('"modal-open"');
  });
});
