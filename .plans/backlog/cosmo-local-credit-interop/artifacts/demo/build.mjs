// Builds the self-contained demo from index.html: every screen and the corner symbol inlined as
// data URIs, so one file works offline apart from the Google Fonts stylesheet.
// Usage, from the repository root, after capture.mjs:
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/build.mjs
// Writes ./output/green-goods-sf-live-demo.html (the Drive copy, a complete document) and
// ./output/artifact.html (the same page without the document wrapper, which the Artifact tool adds).
// Both stay out of git: the screens show identifiable people on the hub's public pages.
// Exits with status 1 when a screen is missing or the page passes 15 MB, and then writes nothing,
// so the last good build in output/ survives a failed one.
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MAX_BYTES = 15 * 1024 * 1024;
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "output");
mkdirSync(out, { recursive: true });
let html = readFileSync(join(here, "index.html"), "utf8");
const problems = [];

const block = html.match(/<script type="application\/json" id="flows">([\s\S]*?)<\/script>/);
const { flows } = JSON.parse(block[1]);
const images = {};
for (const screen of flows.flatMap((f) => f.screens)) {
  const path = join(here, "assets", "screens", `${screen.file}.jpg`);
  if (!existsSync(path)) { problems.push(`missing ${path}; run capture.mjs`); continue; }
  images[screen.file] = `data:image/jpeg;base64,${readFileSync(path).toString("base64")}`;
}
const symbolPath = join(here, "..", "deck", "assets", "brand", "green-goods-symbol.svg");
const symbol = `data:image/svg+xml;base64,${readFileSync(symbolPath).toString("base64")}`;
html = html.replaceAll('src="../deck/assets/brand/green-goods-symbol.svg"', `src="${symbol}"`);
html = html.replace(block[0], `<script type="application/json" id="images">${JSON.stringify(images)}</script>\n${block[0]}`);

const standalone = join(out, "green-goods-sf-live-demo.html");
const size = Buffer.byteLength(html);
if (size > MAX_BYTES) problems.push(`the demo is ${(size / 1048576).toFixed(1)} MB, over 15 MB`);
if (problems.length) {
  for (const p of problems) console.log(`  problem: ${p}`);
  console.log(`build failed with ${problems.length} problem(s); the files in output/ are untouched`);
  process.exit(1);
}
// The Artifact tool wraps a page in its own document with a charset and a viewport meta.
const artifact = html
  .replace(/<!DOCTYPE html>\s*/i, "")
  .replace(/<html[^>]*>\s*/i, "")
  .replace(/<\/html>\s*$/i, "")
  .replace(/<head>\s*/i, "")
  .replace(/\s*<\/head>/i, "")
  .replace(/<body>\s*/i, "")
  .replace(/\s*<\/body>/i, "")
  .replace(/<meta charset="UTF-8" \/>\s*/i, "")
  .replace(/<meta name="viewport"[^>]*>\s*/i, "");
// Both files are written to a staging folder and promoted together: the backup of the current pair
// completes before either is touched, and a rename that fails halfway puts the pair back.
const names = ["green-goods-sf-live-demo.html", "artifact.html"];
const staging = mkdtempSync(join(out, ".build-"));
writeFileSync(join(staging, names[0]), html);
writeFileSync(join(staging, names[1]), artifact);
const backup = mkdtempSync(join(out, ".previous-"));
try {
  for (const name of names) if (existsSync(join(out, name))) copyFileSync(join(out, name), join(backup, name));
} catch (error) {
  for (const dir of [staging, backup]) rmSync(dir, { recursive: true, force: true });
  throw new Error(`${error.message}; nothing in output/ was replaced`);
}
// Only the names that were promoted are rolled back, each on its own, so one that cannot be
// removed never stops the rest from being restored.
const promoted = [];
try {
  for (const name of names) { renameSync(join(staging, name), join(out, name)); promoted.push(name); }
} catch (error) {
  for (const name of promoted) { try { rmSync(join(out, name), { force: true }); } catch {} }
  for (const name of readdirSync(backup)) { try { copyFileSync(join(backup, name), join(out, name)); } catch {} }
  for (const dir of [staging, backup]) rmSync(dir, { recursive: true, force: true });
  throw new Error(`${error.message}; the previous build was put back`);
}
for (const dir of [staging, backup]) rmSync(dir, { recursive: true, force: true });
console.log(`built ${standalone} (${(size / 1048576).toFixed(2)} MB, ${Object.keys(images).length} screens) and output/artifact.html`);
