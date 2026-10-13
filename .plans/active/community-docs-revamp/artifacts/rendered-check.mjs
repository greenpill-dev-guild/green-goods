// Rendered check of a production docs build without a server: a headless Chromium loads
// http://docs.localhost/* and every request is answered from the build directory on disk,
// with the same clean-URL rules the host applies (no trailing slash, .html implied).
// It is a report, not a gate: it prints what it found and always exits 0. Read the findings.
// Label the evidence "clean-room Playwright, headless Chromium, local production build".
// Usage, from the repository root, after `bun run --cwd docs build`:
//   node .plans/active/community-docs-revamp/artifacts/rendered-check.mjs "$PWD" "$PWD/docs/build" <outDir>
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const [root, buildDir, outDir] = process.argv.slice(2);
const require = createRequire(`${root}/package.json`);
const { chromium } = require("@playwright/test");
mkdirSync(outDir, { recursive: true });
const ORIGIN = "http://docs.localhost";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".zip": "application/zip", ".ttf": "font/ttf" };

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath);
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  const base = path.join(buildDir, p);
  const candidates = p === "/" ? [path.join(buildDir, "index.html")] : [base, `${base}.html`, path.join(base, "index.html")];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

async function serve(context) {
  await context.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const file = resolveFile(url.pathname);
    if (!file) {
      const notFound = path.join(buildDir, "404.html");
      return route.fulfill({ status: 404, contentType: TYPES[".html"], body: readFileSync(notFound) });
    }
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
  });
  // Nothing outside the build is needed to render it; block it so the check stays offline.
  await context.route((url) => !url.href.startsWith(ORIGIN), (route) => { blocked.add(new URL(route.request().url()).origin); return route.abort(); });
}

const PAGES = [
  "/", "/community/how-it-works", "/community/why-we-build",
  "/community/gardener-guide", "/community/gardener-guide/installing-and-updating", "/community/gardener-guide/joining-a-garden",
  "/community/gardener-guide/uploading-your-work", "/community/gardener-guide/track-status-and-attestations", "/community/gardener-guide/recovery-and-sync",
  "/community/steward-guide", "/community/steward-guide/creating-a-garden", "/community/steward-guide/managing-members",
  "/community/steward-guide/managing-actions", "/community/steward-guide/reviewing-work", "/community/steward-guide/commitment-pooling",
  "/community/steward-guide/creating-impact-certificates", "/community/steward-guide/funding-and-governance",
  "/community/evaluator-guide", "/community/evaluator-guide/making-an-assessment",
  "/community/funder-guide", "/community/funder-guide/donating-to-a-garden", "/community/funder-guide/funding-a-garden", "/community/funder-guide/withdraw-from-a-vault",
  "/faq", "/glossary", "/community/green-goods-claims", "/reference/product-history", "/brand", "/reference/credits", "/reference/ontology",
];
const REDIRECTS = [
  ["/reference/faq", "/faq"],
  ["/community/steward-guide/making-an-assessment", "/community/evaluator-guide/making-an-assessment"],
  ["/welcome/quickstart-evaluator", "/community/evaluator-guide"],
  ["/evaluator/get-started", "/community/evaluator-guide"],
];
const ANCHORS = [
  ["/faq", "is-what-i-upload-private"], ["/faq", "evaluator"], ["/faq", "privacy"],
  ["/community/how-it-works", "impact-reporting-verification"],
  ["/community/gardener-guide/track-status-and-attestations", "how-gardeners-get-rewarded"],
  ["/community/gardener-guide/track-status-and-attestations", "if-it-is-rejected"],
  ["/community/steward-guide", "get-steward-access"], ["/community/steward-guide", "roles-in-a-garden"],
  ["/community/funder-guide/funding-a-garden", "what-you-are-agreeing-to"],
  ["/community/gardener-guide/installing-and-updating", "if-something-goes-wrong"],
  ["/glossary", "formal-definitions"], ["/glossary", "garden"], ["/glossary", "work-approval"], ["/glossary", "hypercert"], ["/glossary", "cookie-jar"],
];
const SHOTS = new Set(["/", "/community/gardener-guide/uploading-your-work", "/community/steward-guide/reviewing-work", "/faq", "/glossary", "/community/evaluator-guide"]);
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

const blocked = new Set();
const browser = await chromium.launch();
const report = { build: buildDir, pages: [], redirects: [], anchors: [], sidebar: {}, search: {}, notes: [] };

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "reduce" });
  await serve(context);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error" && !/net::ERR_FAILED/.test(message.text())) consoleErrors.push(message.text().slice(0, 200)); });
  page.on("response", (response) => { if (response.status() >= 400 && response.url().startsWith(ORIGIN)) consoleErrors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${String(error).slice(0, 200)}`));

  for (const route of PAGES) {
    consoleErrors.length = 0;
    const response = await page.goto(`${ORIGIN}${route}`, { waitUntil: "load", timeout: 60000 });
    await page.waitForSelector("main h1, article h1, header h1", { timeout: 20000 }).catch(() => {});
    // Lazy images only load when scrolled to; load them all so a broken path shows.
    const images = await page.evaluate(async () => {
      const list = [...document.querySelectorAll("main img")];
      for (const img of list) img.loading = "eager";
      await Promise.all(list.map((img) => (img.complete ? null : new Promise((done) => { img.onload = done; img.onerror = done; setTimeout(done, 8000); }))));
      return list.map((img) => ({ src: img.getAttribute("src"), ok: img.naturalWidth > 0, alt: (img.getAttribute("alt") ?? "").length, wider: img.getBoundingClientRect().width > document.documentElement.clientWidth + 1 }));
    });
    const facts = await page.evaluate(() => ({
      h1: document.querySelector("main h1, article h1, header h1")?.textContent?.trim() ?? null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      figures: document.querySelectorAll("main figure").length,
      captions: document.querySelectorAll("main figure figcaption").length,
      tablesWider: [...document.querySelectorAll("main table")].filter((t) => t.scrollWidth > t.parentElement.clientWidth + 1 && getComputedStyle(t).overflowX === "visible" && getComputedStyle(t.parentElement).overflowX === "visible").length,
      sidebarVisible: Boolean(document.querySelector("aside nav.menu") && document.querySelector("aside nav.menu").getBoundingClientRect().width > 0),
      menuToggleVisible: Boolean(document.querySelector("button.navbar__toggle") && document.querySelector("button.navbar__toggle").getBoundingClientRect().width > 0),
    }));
    report.pages.push({ viewport: name, route, status: response?.status(), ...facts, images: images.length, brokenImages: images.filter((i) => !i.ok).map((i) => i.src), imagesWithoutAlt: images.filter((i) => i.alt === 0).map((i) => i.src), imagesWiderThanViewport: images.filter((i) => i.wider).map((i) => i.src), consoleErrors: [...consoleErrors] });
    if (SHOTS.has(route)) await page.screenshot({ path: path.join(outDir, `${name}${route === "/" ? "-welcome" : route.replace(/\//g, "-")}.png`), fullPage: false });
  }

  if (name === "desktop") {
    await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
    report.sidebar.desktop = await page.evaluate(() => {
      const walk = (list, depth) => [...list.children].flatMap((li) => {
        const link = li.querySelector(":scope > a, :scope > div > a");
        const label = `${"  ".repeat(depth)}${link?.textContent?.trim() ?? "?"}${link?.getAttribute("href") ? `  -> ${link.getAttribute("href")}` : ""}`;
        const child = li.querySelector(":scope > ul");
        return child ? [label, ...walk(child, depth + 1)] : [label];
      });
      const top = document.querySelector("aside nav.menu > ul");
      return top ? walk(top, 0) : null;
    });
    // Search: type into the navbar search and read the suggestions.
    for (const query of ["unsent work", "evaluator", "cookie jar"]) {
      await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
      const input = page.locator("input.navbar__search-input, input[type=search]").first();
      await input.click();
      await input.fill(query);
      await page.waitForTimeout(2500);
      report.search[query] = await page.evaluate(() => [...document.querySelectorAll("[class*=suggestion], .aa-suggestion, [class*=searchResultItem], [class*=hitWrapper]")].slice(0, 6).map((el) => el.textContent.trim().replace(/\s+/g, " ").slice(0, 110)));
    }
    for (const [from, to] of REDIRECTS) {
      await page.goto(`${ORIGIN}${from}`, { waitUntil: "load" });
      await page.waitForURL((url) => url.pathname.replace(/\/$/, "") === to, { timeout: 15000 }).catch(() => {});
      const landed = new URL(page.url()).pathname;
      const h1 = await page.locator("main h1, article h1, header h1").first().textContent().catch(() => null);
      report.redirects.push({ from, expected: to, landed, ok: landed.replace(/\/$/, "") === to, h1: h1?.trim() ?? null });
    }
    for (const [route, id] of ANCHORS) {
      await page.goto(`${ORIGIN}${route}#${id}`, { waitUntil: "load" });
      const found = await page.evaluate((anchor) => Boolean(document.getElementById(anchor)), id);
      report.anchors.push({ route, id, found });
    }
  } else {
    await page.goto(`${ORIGIN}/community/gardener-guide/uploading-your-work`, { waitUntil: "load" });
    await page.locator("button.navbar__toggle").first().click();
    await page.waitForTimeout(800);
    report.sidebar.phone = await page.evaluate(() => [...document.querySelectorAll(".navbar-sidebar .menu__link")].filter((a) => a.getBoundingClientRect().width > 0).map((a) => a.textContent.trim()).slice(0, 40));
    await page.screenshot({ path: path.join(outDir, "phone-menu-open.png") });
  }
  await context.close();
}
await browser.close();

// Markdown twins and llms.txt are build outputs; read them from disk.
const twin = (rel) => (existsSync(path.join(buildDir, rel)) ? readFileSync(path.join(buildDir, rel), "utf8") : null);
const twins = {
  "faq.md": twin("faq.md"),
  "community/evaluator-guide.md": twin("community/evaluator-guide.md"),
  "community/evaluator-guide/making-an-assessment.md": twin("community/evaluator-guide/making-an-assessment.md"),
  "community/steward-guide/managing-members.md": twin("community/steward-guide/managing-members.md"),
  "community/steward-guide/reviewing-work.md": twin("community/steward-guide/reviewing-work.md"),
  "index.md": twin("index.md"),
  "glossary.md": twin("glossary.md"),
  "llms.txt": twin("llms.txt"),
};
report.twins = Object.fromEntries(Object.entries(twins).map(([name, text]) => [name, text === null ? "MISSING" : { bytes: text.length, firstHeading: (text.match(/^# .+$/m) ?? [null])[0] }]));
report.twinFacts = {
  faqHasPrivacyQuestion: Boolean(twins["faq.md"]?.includes("Is what I upload private?")),
  welcomeTwinListsEvaluator: Boolean(twins["index.md"]?.match(/^- \[Evaluator\]\(\/community\/evaluator-guide\/?\)/m)),
  reviewTwinStewardPath: (twins["community/steward-guide/reviewing-work.md"]?.match(/^\d\. \[[^\]]+\]\([^)]+\)$/gm) ?? []),
  llmsListsNewPages: ["/faq", "/community/evaluator-guide", "/community/steward-guide/managing-members"].map((slug) => [slug, Boolean(twins["llms.txt"]?.includes(slug))]),
  oldAssessmentTwinGone: !existsSync(path.join(buildDir, "community/steward-guide/making-an-assessment.md")),
  glossaryTwinLeadsWithEveryday: Boolean(twins["glossary.md"]?.includes("## Everyday terms")),
};
writeFileSync(path.join(outDir, "rendered-report.json"), JSON.stringify(report, null, 1));
const bad = report.pages.filter((p) => p.status !== 200 || p.overflow > 1 || p.brokenImages.length || p.imagesWithoutAlt.length || p.consoleErrors.length || !p.h1 || p.figures !== p.captions);
report.blockedOutsideOrigins = [...blocked];
writeFileSync(path.join(outDir, "rendered-report.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ pagesChecked: report.pages.length, blockedOutsideOrigins: report.blockedOutsideOrigins, pagesWithFindings: bad, sidebar: report.sidebar, redirects: report.redirects, anchorsMissing: report.anchors.filter((a) => !a.found), search: report.search, twins: report.twins, twinFacts: report.twinFacts }, null, 1));
