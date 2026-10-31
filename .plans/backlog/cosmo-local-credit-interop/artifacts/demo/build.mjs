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
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MAX_BYTES = 15 * 1024 * 1024;
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "output");
mkdirSync(out, { recursive: true });
const problems = [];
// The page, the partial-capture marker and the screens are read under the capture's publication
// lock, so a capture publishing at the same moment can never hand the build a page with old
// metadata beside some new screens. The lock names its owner; a stale one (its process gone, or
// older than ten minutes) is moved aside with one rename, so only one waiting run takes it over,
// and a lock without owner.json younger than five seconds is one being taken, not a stale one.
const screensDir = join(here, "assets", "screens");
const lock = join(screensDir, ".publish-lock");
const lockOwner = () => { try { return JSON.parse(readFileSync(join(lock, "owner.json"), "utf8")); } catch { return null; } };
const lockAgeMs = () => { try { return Date.now() - statSync(lock).mtimeMs; } catch { return Infinity; } };
const ownsLock = () => lockOwner()?.pid === process.pid;
const takeLock = () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, "owner.json"), JSON.stringify({ pid: process.pid, at: Date.now() }));
      if (ownsLock()) return;
      continue;
    } catch (error) { if (error.code !== "EEXIST") throw error; }
    const owner = lockOwner();
    if (!owner && lockAgeMs() < 5000) throw new Error(`a capture is taking the publication lock (${lock}); build again when it has finished`);
    const alive = owner?.pid ? (() => { try { process.kill(owner.pid, 0); return true; } catch (e) { return e.code === "EPERM"; } })() : false;
    if (owner && alive && Date.now() - owner.at < 10 * 60 * 1000) throw new Error(`a capture is publishing (${lock}, process ${owner.pid} since ${new Date(owner.at).toISOString()}); build again when it has finished`);
    const aside = `${lock}.stale-${process.pid}-${Date.now()}`;
    try {
      renameSync(lock, aside);
      rmSync(aside, { recursive: true, force: true });
      console.log(`took over a stale publication lock${owner ? ` left by process ${owner.pid}` : ""}`);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  throw new Error(`could not take the publication lock at ${lock} after three attempts`);
};
const releaseLock = () => { if (ownsLock()) rmSync(lock, { recursive: true, force: true }); };
let html;
let block;
let flows;
const images = {};
takeLock();
try {
  if (!ownsLock()) throw new Error(`lost the publication lock at ${lock} to another run; build again`);
  html = readFileSync(join(here, "index.html"), "utf8");
  block = html.match(/<script type="application\/json" id="flows">([\s\S]*?)<\/script>/);
  ({ flows } = JSON.parse(block[1]));
  for (const screen of flows.flatMap((f) => f.screens)) {
    const path = join(screensDir, `${screen.file}.jpg`);
    if (!existsSync(path)) { problems.push(`missing ${path}; run capture.mjs`); continue; }
    images[screen.file] = `data:image/jpeg;base64,${readFileSync(path).toString("base64")}`;
  }
  // A partial capture that could not validate shared swap rules leaves this marker; only a full
  // capture that finishes clean removes it, and until then the screens may show fixture copy.
  const partialMarker = join(screensDir, ".partial-capture.json");
  if (existsSync(partialMarker)) {
    let marker = null;
    try { marker = JSON.parse(readFileSync(partialMarker, "utf8")); } catch {}
    problems.push(`the last capture was partial (${marker?.sessions?.join(", ") || "unknown sessions"}, ${marker?.at || "unknown time"}) and left ${marker?.unvalidated?.length ?? "some"} shared swap rule(s) unvalidated; run a full capture.mjs before building`);
  }
} finally {
  releaseLock();
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
  // A restore that fails keeps the backup folder and names it, so the last good build is never lost.
  const unrestored = [];
  for (const name of promoted) { try { rmSync(join(out, name), { force: true }); } catch { unrestored.push(name); } }
  for (const name of readdirSync(backup)) { try { copyFileSync(join(backup, name), join(out, name)); } catch { unrestored.push(name); } }
  rmSync(staging, { recursive: true, force: true });
  if (unrestored.length) throw new Error(`${error.message}; the rollback could not restore ${[...new Set(unrestored)].join(", ")}, so the backup is kept at ${backup}`);
  rmSync(backup, { recursive: true, force: true });
  throw new Error(`${error.message}; the previous build was put back`);
}
for (const dir of [staging, backup]) rmSync(dir, { recursive: true, force: true });
console.log(`built ${standalone} (${(size / 1048576).toFixed(2)} MB, ${Object.keys(images).length} screens) and output/artifact.html`);
