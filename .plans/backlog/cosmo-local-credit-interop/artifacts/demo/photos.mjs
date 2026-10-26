// Saves the photos of Tech and Sun's approved submissions from its public garden page into
// ./assets/photos as record-NN.jpg (not committed), with record-photos.tsv listing each title.
// Afo cleared the hub's public photos for the demo on 26 October 2026; never use record-15, a
// letter that names a person. capture.mjs swaps these into the Work flow.
// Usage, from the repository root (needs the repository's Playwright install and network access):
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/photos.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("@playwright/test"); }
const out = join(dirname(fileURLToPath(import.meta.url)), "assets", "photos");
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto("https://greengoods.app/gardens/tas-hub", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(3000);
await page.getByRole("button", { name: /Show more submissions/i }).first().click().catch(() => console.log("no Show more button; saving what the page shows"));
await page.waitForTimeout(2500);
// The section's images load as they scroll into view.
for (let y = 0; y < 9000; y += 600) { await page.evaluate((top) => window.scrollTo(0, top), y); await page.waitForTimeout(400); }
await page.waitForTimeout(2500);
const cards = await page.evaluate(() => {
  const section = document.getElementById("public-garden-detail-notes")?.closest("section");
  return [...(section?.querySelectorAll("img") ?? [])].map((img) => ({
    src: img.currentSrc,
    text: (img.closest("article, li") || img.parentElement.parentElement).innerText.replace(/\s+/g, " ").trim().slice(0, 120),
  }));
});
const rows = [];
for (const [i, card] of cards.entries()) {
  if (!card.src || card.src.startsWith("data:")) continue;
  const res = await page.request.get(card.src);
  if (!res.ok()) { console.log(`skipped ${card.src}: ${res.status()}`); continue; }
  const file = `record-${String(i + 1).padStart(2, "0")}.jpg`;
  writeFileSync(join(out, file), await res.body());
  rows.push(`${file}\t${card.text}`);
}
writeFileSync(join(out, "record-photos.tsv"), `${rows.join("\n")}\n`);
console.log(`saved ${rows.length} photos into ${out}`);

// The proof on the hub's one course promise that is waiting to be confirmed: a photo of the
// course's final assessment. The photo also shows the member's browser profile menu with their
// name and email, so only the assessment panel is kept, as proof-course.jpg.
const PROOF = "https://greengoods.mypinata.cloud/ipfs/bafkreie3p3ji5l7lufiocgkdswktr2rj7tiptklzd3cdnkx6ifvk4bjzvi";
const proof = await page.request.get(PROOF);
if (!proof.ok()) console.log(`skipped the course proof: ${proof.status()}`);
else {
  const cropped = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    // The 1280x720 photo: the assessment panel sits left of the profile menu (x 882 and right)
    // and below the tab and address bars (y 140 and up).
    const [sx, sy, sw, sh] = [140, 140, 735, 500];
    const canvas = Object.assign(document.createElement("canvas"), { width: sw, height: sh });
    canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, `data:image/jpeg;base64,${(await proof.body()).toString("base64")}`);
  writeFileSync(join(out, "proof-course.jpg"), Buffer.from(cropped.split(",")[1], "base64"));
  console.log("saved proof-course.jpg");
}
await browser.close();
