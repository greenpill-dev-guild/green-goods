#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { createReadStream, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const staticDir = resolve(repoRoot, "packages/shared/storybook-static");
const outputDir = resolve(repoRoot, "tmp/storybook-design-assets/screenshots");

// Map each Storybook title to a per-view bucket. Output structure:
//   screenshots/<bucket>/<theme>/<TitleSlug>/<Variant>.png
// Buckets reflect the per-view session model in .plans/active/admin-claude-design-export/.
const TITLE_BUCKETS = [
  { bucket: "hub", pattern: /^Admin\/Workspaces\/Hub$/ },
  { bucket: "garden", pattern: /^Admin\/Workspaces\/Garden$/ },
  { bucket: "community", pattern: /^Admin\/Workspaces\/Community$/ },
  { bucket: "actions", pattern: /^Admin\/Workspaces\/Actions$/ },
  { bucket: "primitives", pattern: /^Admin\/Primitives\// },
  { bucket: "shell", pattern: /^Admin\/Shell\/CanvasLayout$/ },
  {
    bucket: "shell",
    pattern: /^Shared\/Canvas\/(AppBar|NavigationBar|MainSheet|LeftSheet|RightSheet|BottomSheet|FabContext)$/,
  },
  { bucket: "tokens", pattern: /^Shared\/Tokens\// },
];

function bucketFor(title) {
  for (const { bucket, pattern } of TITLE_BUCKETS) {
    if (pattern.test(title)) return bucket;
  }
  return null;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const variantMode = flags.variants === "all" ? "all" : "first";
const titleFilter = typeof flags.titles === "string" ? flags.titles.toLowerCase() : null;
const themes = (flags.themes ?? "light,dark").split(",");
const port = Number(flags.port ?? 6789);

function safeSlug(s) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function startStaticServer(rootDir, port) {
  const server = createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = join(rootDir, urlPath);
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    let stat;
    try {
      stat = statSync(filePath);
    } catch {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    if (stat.isDirectory()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-store",
    });
    createReadStream(filePath).pipe(res);
  });
  return new Promise((resolveStart) => server.listen(port, () => resolveStart(server)));
}

async function main() {
  const indexPath = join(staticDir, "index.json");
  let index;
  try {
    index = JSON.parse(readFileSync(indexPath, "utf8"));
  } catch (err) {
    console.error(`Cannot read ${indexPath}. Run: bun --cwd packages/shared run build-storybook`);
    process.exit(1);
  }

  const allStories = Object.values(index.entries).filter((e) => e.type === "story");
  const matchedTitles = new Set();
  const targets = allStories.filter((s) => {
    if (bucketFor(s.title) === null) return false;
    if (titleFilter && !s.title.toLowerCase().includes(titleFilter)) return false;
    if (variantMode === "first") {
      if (matchedTitles.has(s.title)) return false;
      matchedTitles.add(s.title);
    }
    return true;
  });

  console.log(`Storybook static: ${staticDir}`);
  console.log(`Target stories: ${targets.length} (${variantMode} variants per title)`);
  console.log(`Themes: ${themes.join(", ")}`);
  console.log(`Total captures: ${targets.length * themes.length}`);
  console.log(`Output: ${outputDir}`);

  const server = await startStaticServer(staticDir, port);
  console.log(`Static server listening on http://localhost:${port}`);

  const browser = await chromium.launch();
  let captured = 0;
  let failed = 0;
  const startTime = Date.now();

  try {
    for (const story of targets) {
      const isRoute = /^Admin\/Workspaces\//.test(story.title);
      const viewport = isRoute
        ? { width: 1440, height: 1024 }
        : { width: 1280, height: 800 };

      const bucket = bucketFor(story.title);
      for (const theme of themes) {
        const url = `http://localhost:${port}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story&globals=theme:${theme}`;
        const titleSlug = safeSlug(story.title);
        const variantSlug = safeSlug(story.name);
        const filePath = join(outputDir, bucket, theme, titleSlug, `${variantSlug}.png`);
        mkdirSync(dirname(filePath), { recursive: true });

        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
          await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(800);
          await page.screenshot({ path: filePath, fullPage: isRoute });
          captured += 1;
          if (captured % 10 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[${captured}/${targets.length * themes.length}] ${elapsed}s elapsed`);
          }
        } catch (err) {
          failed += 1;
          console.error(`FAIL ${theme} ${story.title} :: ${story.name} → ${err.message}`);
        } finally {
          await ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone. Captured ${captured}, failed ${failed}, in ${elapsed}s.`);
  console.log(`Output tree: ${outputDir}`);
  if (failed > 0) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
