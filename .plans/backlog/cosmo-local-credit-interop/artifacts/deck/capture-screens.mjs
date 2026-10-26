// Captures the deck's two product screens into ./assets/screens (not committed).
// Usage, from the repository root (needs the repository's Playwright install and network access):
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/deck/capture-screens.mjs
// Both screens come from the deployed Storybook: real components with demo data. The deck and
// brief show them on the commitment pooling slide and page.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("@playwright/test"); }
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "assets", "screens");
mkdirSync(out, { recursive: true });
const story = (id) => `https://design.greengoods.app/iframe.html?viewMode=story&id=${id}`;
// Slide 3 crops each phone screen in CSS: the garden page below its demo photo, and the whole
// confirm sheet, captured at a shorter viewport so the sheet fits its content.
// `expect` names copy the story must show: Storybook's own "story not found" view also fills
// #storybook-root, so a removed or renamed story would otherwise overwrite a screen with an error
// page that the deck and brief checks, which only test that the image loads, would pass.
const shots = [
  { file: "garden-promises.png", url: story("client-commitments-gardenpool--live"), w: 390, h: 1100, storybook: true, expect: ["3 of 7 kept", "Needs you"] },
  { file: "confirm.png", url: story("client-commitments-confirmsheet--ask-garden-work"), w: 390, h: 740, storybook: true, expect: ["Was the work you asked for done?"] },
];
// Both screens are staged and replace the current pair together, only once every story has
// passed its check, so a failure never leaves one new screen beside one old one.
const staging = mkdtempSync(join(out, ".capture-"));
const browser = await pw.chromium.launch();
try {
  for (const s of shots) {
    const context = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2, colorScheme: "light" });
    const page = await context.newPage();
    await page.goto(s.url, { waitUntil: "networkidle", timeout: 90000 });
    if (s.storybook) await page.waitForSelector("#storybook-root > *", { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(s.storybook ? 2500 : 6000);
    // The stories' own fonts: fonts.ready also resolves after a font request fails, and text set in
    // a fallback face would be rasterized into the screen, so no face may be in error and every
    // face used by visible text must be loaded.
    // For every web font that visible text asks for first (system and generic families aside), the
    // exact face is loaded on purpose and must come back loaded: fonts.check() says yes when no face
    // exists at all, which is just what a failed stylesheet looks like, so it is never trusted here.
    const fontProblems = await page.evaluate(async () => {
      const system = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "helvetica", "helvetica neue", "arial", "georgia", "times new roman", "times", "courier", "courier new", "apple color emoji", "segoe ui emoji", "noto color emoji"]);
      const problems = [...document.fonts].filter((f) => f.status === "error").map((f) => `${f.family.replace(/["']/g, "")} ${f.weight} ${f.style} failed to load`);
      const wanted = new Map();
      for (const el of document.querySelectorAll("body *")) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const family = cs.fontFamily.split(",")[0].trim().replace(/["']/g, "");
        if (system.has(family.toLowerCase())) continue;
        wanted.set(`${cs.fontStyle} ${cs.fontWeight} 16px "${family}"`, family);
      }
      for (const [spec, family] of wanted) {
        const faces = await document.fonts.load(spec, "Aa").catch(() => []);
        if (!faces.length || faces.some((f) => f.status !== "loaded")) problems.push(`${family} (${spec.split(" ").slice(0, 2).join(" ")}) is not loaded for visible text`);
      }
      return problems;
    });
    if (fontProblems.length) throw new Error(`${s.file}: ${fontProblems.join("; ")}; neither screen was replaced`);
    const text = await page.evaluate(() => document.body.innerText);
    const missing = s.expect.filter((t) => !text.includes(t));
    if (/couldn't find story|story not found|no story matched/i.test(text) || missing.length) {
      throw new Error(`${s.file}: the story did not show ${missing.length ? `"${missing.join('", "')}"` : "its content"}; neither screen was replaced`);
    }
    // Every image a person can see on the screen must have decoded pixels (the garden story's
    // banner, for one), or a failed or undecodable image request would be rasterized into the
    // screen and no later check could see it.
    const blank = await page.evaluate(() => [...document.querySelectorAll("img")].filter((img) => {
      const r = img.getBoundingClientRect();
      const visible = r.width >= 24 && r.height >= 24 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && getComputedStyle(img).visibility !== "hidden";
      return visible && !(img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
    }).map((img) => (img.currentSrc || img.getAttribute("src") || "(no src)").replace(/^data:[^,]*,.*/, "(data URI)").slice(0, 90)));
    if (blank.length) throw new Error(`${s.file}: ${blank.length} visible image(s) did not load or decode (${blank.join(" | ")}); neither screen was replaced`);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.mouse.move(1, 1);
    await page.screenshot({ path: join(staging, s.file) });
    await context.close();
  }
  // Backup, promotion and rollback run as one owned transaction under a lock, so two runs in the
  // same checkout can never interleave their pairs. The lock names its owner; a lock left by a run
  // that died or was stopped (its process gone, or older than ten minutes) is taken over, a live
  // owner is respected, and the lock is released on every path out.
  const lock = join(out, ".publish-lock");
  const lockOwner = () => { try { return JSON.parse(readFileSync(join(lock, "owner.json"), "utf8")); } catch { return null; } };
  const lockAgeMs = () => { try { return Date.now() - statSync(lock).mtimeMs; } catch { return Infinity; } };
  const ownsLock = () => lockOwner()?.pid === process.pid;
  // A stale lock is moved aside with one rename, which only one of two runs that saw it can win;
  // the other then finds no lock, or the winner's, and acts on that. A lock without owner.json that
  // is younger than five seconds belongs to a run that has created it and not yet named itself, so
  // it is live. Ownership is read back after writing and checked again before anything is replaced
  // or released.
  const takeLock = () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        mkdirSync(lock);
        writeFileSync(join(lock, "owner.json"), JSON.stringify({ pid: process.pid, at: Date.now() }));
        if (ownsLock()) return;
        continue;
      } catch (error) { if (error.code !== "EEXIST") throw error; }
      const owner = lockOwner();
      if (!owner && lockAgeMs() < 5000) throw new Error(`another capture is taking the publication lock (${lock}); neither screen was replaced`);
      const alive = owner?.pid ? (() => { try { process.kill(owner.pid, 0); return true; } catch (e) { return e.code === "EPERM"; } })() : false;
      if (owner && alive && Date.now() - owner.at < 10 * 60 * 1000) throw new Error(`another capture is publishing (${lock}, process ${owner.pid} since ${new Date(owner.at).toISOString()}); neither screen was replaced`);
      const aside = `${lock}.stale-${process.pid}-${Date.now()}`;
      try {
        renameSync(lock, aside);
        rmSync(aside, { recursive: true, force: true });
        console.log(`took over a stale publication lock${owner ? ` left by process ${owner.pid}` : ""}`);
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    throw new Error(`could not take the publication lock at ${lock} after three attempts; neither screen was replaced`);
  };
  const releaseLock = () => { if (ownsLock()) rmSync(lock, { recursive: true, force: true }); };
  takeLock();
  try {
    if (!ownsLock()) throw new Error(`lost the publication lock at ${lock} to another run; neither screen was replaced`);
    // The current pair is backed up first, so a rename that fails halfway puts the old pair back
    // rather than leaving one new screen beside one old one. The backup completes before either
    // screen is touched, and only the screens that were promoted are rolled back, each on its own.
    const backup = mkdtempSync(join(out, ".previous-"));
    try {
      for (const s of shots) if (existsSync(join(out, s.file))) copyFileSync(join(out, s.file), join(backup, s.file));
    } catch (error) {
      rmSync(backup, { recursive: true, force: true });
      throw new Error(`${error.message}; neither screen was replaced`);
    }
    const promoted = [];
    try {
      for (const s of shots) { renameSync(join(staging, s.file), join(out, s.file)); promoted.push(s.file); console.log(join(out, s.file)); }
    } catch (error) {
      // A restore that fails keeps the backup folder and names it, so the last good pair is never lost.
      const unrestored = [];
      for (const name of promoted) { try { rmSync(join(out, name), { force: true }); } catch { unrestored.push(name); } }
      for (const name of readdirSync(backup)) { try { copyFileSync(join(backup, name), join(out, name)); } catch { unrestored.push(name); } }
      if (unrestored.length) throw new Error(`${error.message}; the rollback could not restore ${[...new Set(unrestored)].join(", ")}, so the backup is kept at ${backup}`);
      rmSync(backup, { recursive: true, force: true });
      throw new Error(`${error.message}; the previous pair was put back`);
    }
    rmSync(backup, { recursive: true, force: true });
  } finally {
    releaseLock();
  }
} finally {
  rmSync(staging, { recursive: true, force: true });
  await browser.close();
}
