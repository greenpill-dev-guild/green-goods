#!/usr/bin/env node
/* Renders the labeled prototype evidence in evidence/ from prototype.html, and sweeps every state
   for clipped content. Uses the repository's @playwright/test (after `bun install`) or any
   Playwright on the module path; it installs nothing.

     node render-evidence.mjs
*/
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("@playwright/test")); } catch { ({ chromium } = require("playwright")); }

const SHOTS = [
  ["m04-review-en-390", "M04@review", "en", "light", "phone"],
  ["m05-unknown-es-390", "M05@unknown", "es", "light", "phone"],
  ["m06-accepted-en-390", "M06@accepted", "en", "light", "phone"],
  ["m06-refundfail-pt-360", "M06@refundfail", "pt", "light", "both", 1],
  ["m06-checked-en-wide", "M06@checked", "en", "light", "wide"],
  ["m08-accounts-en-390", "M08@accounts", "en", "light", "phone"],
  ["m09-cancelpending-es-390", "M09@cancelpending", "es", "light", "phone"],
  ["m10-review-en-390", "M10@review", "en", "light", "phone"],
  ["m10-frozen-pt-360", "M10@frozen", "pt", "light", "both", 1],
  ["m14-unknown-en-390-dark", "M14@unknown", "en", "dark", "phone"],
  ["m15-kept-pt-390", "M15@kept", "pt", "light", "phone"],
  ["s02-unverified-en-desktop", "S02@unverified", "en", "light", "desk"],
  ["s03-check-es-phone", "S03@check", "es", "light", "phone"],
  ["s04-short-en-desktop", "S04@short", "en", "light", "desk"],
  ["s09-split-en-desktop", "S09@split", "en", "light", "desk"],
  ["s10-legfail-pt-desktop", "S10@legfail", "pt", "light", "desk"],
  ["s12-pause-en-desktop", "S12@pause", "en", "light", "desk"]
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("file://" + join(here, "prototype.html") + "#member");
await page.waitForTimeout(600);
/* Keep the sticky review bar out of element screenshots. */
await page.addStyleTag({ content: ".bar { position: static !important; }" });
for (const [name, target, lang, theme, frames, index = 0] of SHOTS) {
  await page.evaluate(([t, l, th, fr]) => {
    const s = GG.app.state;
    s.lang = l; s.ftheme = th;
    if (t.startsWith("M")) s.mfr = fr; else s.sfr = fr;
    GG.app.open(t);
  }, [target, lang, theme, frames]);
  await page.waitForTimeout(250);
  const frame = page.locator(".view:not([hidden]) .fwrap").nth(index);
  await frame.screenshot({ path: join(here, "evidence", `${name}.png`) });
}
await page.evaluate(() => GG.app.setView("architecture"));
await page.waitForTimeout(300);
await page.screenshot({ path: join(here, "evidence", "architecture.png"), fullPage: true });

/* Clipping sweep: every screen, state and language at each frame size. */
const findings = await page.evaluate(() => {
  const out = [];
  const designedTruncation = ".title,.detail,.pill,.lbl,.nm,.mid,.tl,.sbadge,.stabs span,.fcap,.chip2,.ic,.badge";
  const kinds = { member: [["phone", 0], ["both", 1], ["wide", 0]], steward: [["desk", 0], ["phone", 0]] };
  for (const id of Object.keys(GG.screens)) {
    const d = GG.screens[id];
    for (const [st] of d.states) for (const lang of ["en", "es", "pt"]) for (const [fr, idx] of kinds[d.surface]) {
      const s = GG.app.state; s.lang = lang; s.ftheme = "light";
      if (d.surface === "member") s.mfr = fr; else s.sfr = fr;
      GG.app.open(id + "@" + st);
      const f = document.querySelectorAll(".view:not([hidden]) .frame")[idx];
      f.querySelectorAll("*").forEach((el) => {
        if (el.closest(designedTruncation) || el.matches(".screen,.sbody,.c-route,.db,.splitbar,.splitbar *")) return;
        if (el.scrollWidth > el.clientWidth + 1) out.push(`${id}@${st} ${lang} ${fr}: ${(el.textContent || "").trim().slice(0, 40)}`);
      });
    }
  }
  return [...new Set(out)];
});
await browser.close();
console.log(`Evidence written: ${SHOTS.length + 1} images. Page errors: ${errors.length}. Clipping findings: ${findings.length}.`);
if (findings.length) console.log(findings.slice(0, 40).join("\n"));
if (errors.length || findings.length) process.exit(1);
