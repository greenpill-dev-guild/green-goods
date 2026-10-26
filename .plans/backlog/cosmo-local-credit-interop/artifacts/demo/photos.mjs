// Saves the photos of Tech and Sun's approved submissions from its public garden page into
// ./assets/photos as record-NN.jpg (not committed), with record-photos.tsv listing each title, and
// crops the course proof on the hub's one waiting promise to proof-course.jpg from a raw copy
// placed by hand (assets/photos/proof-raw.jpg, from the same private handoff as the Awka photo;
// this file names no address for it, since the raw photo shows a member's name and email).
// Afo cleared the hub's public photos for the demo on 26 October 2026; never use record-15, a
// letter that names a person. capture.mjs swaps these into the Work and Promise flows.
// Usage, from the repository root (needs the repository's Playwright install and network access):
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/photos.mjs
// The set is replaced whole: every photo downloads into a temporary folder first, and one failed
// download leaves the existing set untouched and exits with status 1, so a stale record-NN.jpg
// never survives a refresh unnoticed.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
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
const wanted = cards.map((card, i) => ({ ...card, file: `record-${String(i + 1).padStart(2, "0")}.jpg` })).filter((card) => card.src && !card.src.startsWith("data:"));
if (!wanted.length) {
  await browser.close();
  console.log(`no submission photos found on the page; the existing set in ${out} is untouched`);
  process.exit(1);
}
const temp = mkdtempSync(join(out, ".refresh-"));
const rows = [];
const failures = [];
// A 200 with an HTML error body or a truncated file is not a photo: the body must start like an
// image (JPEG, PNG, WebP or GIF), or the refresh fails.
const looksLikeImage = (body) => (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff)
  || body.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  || (body.subarray(0, 4).toString("latin1") === "RIFF" && body.subarray(8, 12).toString("latin1") === "WEBP")
  || body.subarray(0, 4).toString("latin1") === "GIF8";
for (const card of wanted) {
  const res = await page.request.get(card.src);
  if (!res.ok()) { failures.push(`${card.file}: ${res.status()} for ${card.src}`); continue; }
  const body = await res.body();
  if (body.length < 1024 || !looksLikeImage(body)) { failures.push(`${card.file}: not an image (${res.headers()["content-type"] || "no content type"}, ${body.length} bytes) for ${card.src}`); continue; }
  writeFileSync(join(temp, card.file), body);
  rows.push(`${card.file}\t${card.text}`);
}

// The proof on the hub's one course promise that is waiting to be confirmed: a photo of the
// course's final assessment, which also shows the member's browser profile menu with their name
// and email. The raw photo arrives by hand as proof-raw.jpg, never enters git and is never fetched
// from here; only the assessment panel is kept, as proof-course.jpg. A cropped file placed by
// hand is kept as it is when no raw photo is present.
const rawProof = join(out, "proof-raw.jpg");
const proofBody = existsSync(rawProof) ? readFileSync(rawProof) : null;
if (!proofBody) { if (!existsSync(join(out, "proof-course.jpg"))) failures.push("proof-course.jpg: neither it nor proof-raw.jpg is in assets/photos; place one from the private handoff"); }
else if (proofBody.length < 1024 || !looksLikeImage(proofBody)) failures.push(`proof-course.jpg: proof-raw.jpg is not an image (${proofBody.length} bytes)`);
else {
  const cropped = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    if (img.naturalWidth !== 1280 || img.naturalHeight !== 720) return null;
    // The 1280x720 photo: the assessment panel sits left of the profile menu (x 882 and right)
    // and below the tab and address bars (y 140 and up).
    const [sx, sy, sw, sh] = [140, 140, 735, 500];
    const canvas = Object.assign(document.createElement("canvas"), { width: sw, height: sh });
    canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, `data:image/jpeg;base64,${proofBody.toString("base64")}`).catch(() => null);
  // The crop is measured on this one photo; any other size would keep the name and email in view.
  if (!cropped) failures.push("proof-course.jpg: proof-raw.jpg is not the 1280x720 photo the crop was measured on");
  else writeFileSync(join(temp, "proof-course.jpg"), Buffer.from(cropped.split(",")[1], "base64"));
}
await browser.close();
if (failures.length) {
  rmSync(temp, { recursive: true, force: true });
  for (const failure of failures) console.log(`  problem: ${failure}`);
  console.log(`refresh failed: ${failures.length} problem(s) across ${wanted.length} photos and the proof; the existing set in ${out} is untouched and may be stale`);
  process.exit(1);
}
// Replace the whole set at once, so an old record-NN.jpg never outlives the page's current list.
// The current set is backed up first and put back if any step of the replacement fails, so a
// half-replaced set never results.
// A cropped proof placed by hand stays unless this run cropped a new one; proof-raw.jpg never moves.
const isRecord = (name) => /^record-\d+\.jpg$/.test(name) || name === "record-photos.tsv" || (name === "proof-course.jpg" && existsSync(join(temp, "proof-course.jpg")));
const backup = mkdtempSync(join(out, ".previous-"));
const previous = readdirSync(out).filter(isRecord);
// The current set moves aside whole before anything is installed; a move that fails halfway moves
// back what had gone and installs nothing.
try {
  for (const name of previous) renameSync(join(out, name), join(backup, name));
} catch (error) {
  for (const name of readdirSync(backup)) renameSync(join(backup, name), join(out, name));
  for (const dir of [temp, backup]) rmSync(dir, { recursive: true, force: true });
  throw new Error(`${error.message}; the photo set is as it was`);
}
const installed = readdirSync(temp);
try {
  for (const name of installed) renameSync(join(temp, name), join(out, name));
  writeFileSync(join(out, "record-photos.tsv"), `${rows.join("\n")}\n`);
} catch (error) {
  for (const name of [...installed, "record-photos.tsv"]) rmSync(join(out, name), { force: true });
  for (const name of readdirSync(backup)) renameSync(join(backup, name), join(out, name));
  for (const dir of [temp, backup]) rmSync(dir, { recursive: true, force: true });
  throw new Error(`${error.message}; the previous photo set was put back`);
}
for (const dir of [temp, backup]) rmSync(dir, { recursive: true, force: true });
console.log(`saved ${rows.length} photos into ${out}; proof-course.jpg ${proofBody ? "cropped from proof-raw.jpg" : "kept as placed"}`);
