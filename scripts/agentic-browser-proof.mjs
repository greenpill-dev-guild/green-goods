#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = "127.0.0.1";
const artifactDir = path.join(repoRoot, ".codex-artifacts", "agentic-browser-proof");
const widths = (process.env.GREEN_GOODS_BROWSER_PROOF_WIDTHS || "375,1024,1440")
  .split(",")
  .map((width) => Number(width.trim()))
  .filter((width) => Number.isFinite(width) && width > 0);

const surfaces = [
  {
    name: "client",
    root: path.join(repoRoot, "packages/client/dist"),
    publicRoot: true,
    spaFallback: true,
    routes: ["/", "/fund", "/impact", "/gardens", "/actions", "/cookies"],
  },
  {
    name: "admin",
    root: path.join(repoRoot, "packages/admin/dist"),
    publicRoot: false,
    spaFallback: true,
    routes: ["/", "/hub/work", "/actions", "/profile"],
  },
  {
    name: "docs",
    root: path.join(repoRoot, "docs/build"),
    publicRoot: true,
    spaFallback: false,
    routes: ["/", "/builders/agentic/codex", "/builders/testing/storybook", "/builders/quality/agentic-eval"],
  },
];

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function existsExecutable(candidate) {
  if (!candidate) return false;
  try {
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function discoverCachedChromium() {
  const found = [];
  const tryGlob = (base, leaf) => {
    try {
      for (const entry of readdirSync(base)) {
        const candidate = leaf(entry);
        if (existsExecutable(candidate)) found.push(candidate);
      }
    } catch {
      // Cache directory may not exist on this machine.
    }
  };

  const home = homedir();
  const playwright = path.join(home, "Library/Caches/ms-playwright");
  tryGlob(playwright, (entry) => path.join(playwright, entry, "chrome-headless-shell-mac-arm64/chrome-headless-shell"));
  tryGlob(playwright, (entry) => path.join(playwright, entry, "chrome-headless-shell-mac-x64/chrome-headless-shell"));
  tryGlob(playwright, (entry) => path.join(playwright, entry, "chrome-mac/Chromium.app/Contents/MacOS/Chromium"));

  const puppeteer = path.join(home, ".cache/puppeteer/chrome");
  tryGlob(puppeteer, (entry) =>
    path.join(
      puppeteer,
      entry,
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    ),
  );

  const chromeForTesting = path.join(home, ".cache/chrome-for-testing/chrome");
  tryGlob(chromeForTesting, (entry) =>
    path.join(
      chromeForTesting,
      entry,
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    ),
  );
  tryGlob(chromeForTesting, (entry) =>
    path.join(
      chromeForTesting,
      entry,
      "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    ),
  );

  return found;
}

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.CHROMIUM_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    ...discoverCachedChromium(),
  ].filter(Boolean);
  return candidates.find(existsExecutable) || "";
}

function ensureBuildOutputs() {
  const missing = surfaces.filter((surface) => !existsSync(path.join(surface.root, "index.html")));
  if (missing.length) {
    throw new Error(
      `Missing built output for ${missing.map((surface) => surface.name).join(", ")}. Run bun run browser-proof:routes.`,
    );
  }
}

function contentTypeFor(filePath) {
  return contentTypes.get(path.extname(filePath)) || "application/octet-stream";
}

function resolveStaticFile(surface, requestPath) {
  const pathname = decodeURIComponent(requestPath);
  if (pathname.includes("\0")) return null;

  const candidate = path.resolve(surface.root, `.${pathname}`);
  const rootWithSeparator = `${surface.root}${path.sep}`;
  if (candidate !== surface.root && !candidate.startsWith(rootWithSeparator)) return null;

  try {
    const stat = statSync(candidate);
    if (stat.isFile()) return { filePath: candidate, statusCode: 200 };
    if (stat.isDirectory()) {
      const indexPath = path.join(candidate, "index.html");
      if (existsSync(indexPath)) return { filePath: indexPath, statusCode: 200 };
    }
  } catch {
    // Try extension and SPA fallbacks below.
  }

  if (!path.extname(candidate)) {
    const htmlPath = `${candidate}.html`;
    try {
      if (statSync(htmlPath).isFile()) return { filePath: htmlPath, statusCode: 200 };
    } catch {
      // Try the SPA fallback below.
    }
  }

  if (surface.spaFallback) {
    return { filePath: path.join(surface.root, "index.html"), statusCode: 200 };
  }

  return null;
}

async function startStaticServer(surface) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", `http://${host}`);
    const resolved = resolveStaticFile(surface, url.pathname);

    if (!resolved) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(resolved.statusCode, { "content-type": contentTypeFor(resolved.filePath) });
    response.end(readFileSync(resolved.filePath));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error(`Could not bind static server for ${surface.name}.`);
  }

  return {
    ...surface,
    origin: `http://${host}:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function auditLlmsTxt(surface) {
  if (!surface.publicRoot) {
    return {
      status: "not_applicable",
      message: "not a public/docs surface",
    };
  }

  try {
    const response = await fetch(`${surface.origin}/llms.txt`);
    const body = await response.text();
    return {
      status: response.ok && body.trim() ? "ok" : "missing",
      statusCode: response.status,
      contentType: response.headers.get("content-type") || "",
      bytes: Buffer.byteLength(body),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function launchChrome() {
  const chromeBinary = findChromeBinary();
  if (!chromeBinary) throw new Error("No Chrome or Chromium binary found for browser proof.");

  const userDataDir = path.join(tmpdir(), `green-goods-agentic-browser-proof-${process.pid}`);
  const child = spawn(chromeBinary, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-extensions",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  const wsUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for Chrome DevTools endpoint.")), 15000);
    child.stderr.on("data", (chunk) => {
      const match = chunk.toString().match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Chrome exited before DevTools endpoint was ready: ${code}`));
    });
  });

  return {
    wsUrl,
    async close() {
      child.kill("SIGTERM");
      rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => this.handleMessage(event));
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (!message.id || !this.pending.has(message.id)) return;

    const { resolve, reject } = this.pending.get(message.id);
    this.pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
    else resolve(message.result || {});
  }

  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 15000);
    });
  }

  close() {
    this.ws.close();
  }
}

async function evaluate(client, sessionId, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result?.value;
}

async function waitForExpression(client, sessionId, expression, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, sessionId, expression).catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

function summarizeAxTree(nodes) {
  return nodes
    .map((node) => ({
      role: node.role?.value || "",
      name: node.name?.value || "",
    }))
    .filter((node) => node.role || node.name)
    .slice(0, 180);
}

function slugRoute(surfaceName, route, width) {
  const routeSlug = route === "/" ? "home" : route.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "-").replace(/-$/, "");
  return `${surfaceName}-${routeSlug}-${width}`;
}

function isAdvisoryConsoleError(message) {
  return /Indexer query failed/.test(message);
}

async function verifyRoute(client, surface, route, width) {
  const target = await client.send("Target.createTarget", { url: "about:blank" });
  const attached = await client.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  const sessionId = attached.sessionId;
  const height = width <= 500 ? 900 : 920;
  const reduceMotion = width <= 500;
  const slug = slugRoute(surface.name, route, width);
  const screenshotPath = path.join(artifactDir, `${slug}.png`);
  const axPath = path.join(artifactDir, `${slug}.ax.json`);
  const url = `${surface.origin}${route}`;

  try {
    await client.send("Page.enable", {}, sessionId);
    await client.send("Runtime.enable", {}, sessionId);
    await client.send("Accessibility.enable", {}, sessionId);
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.__agenticProof = { consoleErrors: [], pageErrors: [] };
        const originalConsoleError = console.error;
        console.error = (...args) => {
          window.__agenticProof.consoleErrors.push(args.map(String).join(' '));
          originalConsoleError.apply(console, args);
        };
        window.addEventListener('error', (event) => {
          window.__agenticProof.pageErrors.push(event.message || 'unknown error');
        });
        window.addEventListener('unhandledrejection', (event) => {
          window.__agenticProof.pageErrors.push(String(event.reason || 'unhandled rejection'));
        });
      `,
    }, sessionId);
    await client.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width <= 500,
    }, sessionId);
    await client.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: reduceMotion ? "reduce" : "no-preference" }],
    }, sessionId);

    const response = await fetch(url);
    await client.send("Page.navigate", { url }, sessionId);
    await waitForExpression(client, sessionId, "document.readyState === 'complete'");
    await new Promise((resolve) => setTimeout(resolve, 350));

    const runtime = await evaluate(client, sessionId, `
      (() => {
        const proof = window.__agenticProof || { consoleErrors: [], pageErrors: [] };
        const modelContext = 'modelContext' in navigator ? navigator.modelContext : undefined;
        const declarativeTools = [...document.querySelectorAll('form[toolname], form[tooldescription]')].map((form) => ({
          name: form.getAttribute('toolname') || '',
          description: form.getAttribute('tooldescription') || ''
        }));
        const overflowElements = [...document.querySelectorAll('body *')]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(),
              className: typeof element.className === 'string' ? element.className : '',
              text: (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 100),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width)
            };
          })
          .filter((element) => element.right > window.innerWidth + 1 || element.left < -1)
          .slice(0, 16);
        return {
          title: document.title,
          hasMainOrShell: Boolean(document.querySelector('main, [role="main"], #root, #__docusaurus')),
          mainExists: Boolean(document.querySelector('main, [role="main"]')),
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          viewportWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          overflowElements,
          consoleErrors: proof.consoleErrors,
          pageErrors: proof.pageErrors,
          webMcp: {
            status: Boolean(modelContext) || declarativeTools.length > 0 ? 'detected' : 'not_configured',
            navigatorModelContext: Boolean(modelContext),
            registerToolType: typeof modelContext?.registerTool,
            declarativeTools
          }
        };
      })()
    `);

    const axTree = await client.send("Accessibility.getFullAXTree", {}, sessionId);
    const screenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId);
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
    writeFileSync(axPath, `${JSON.stringify(summarizeAxTree(axTree.nodes || []), null, 2)}\n`);

    const advisoryConsoleErrors = runtime.consoleErrors.filter(isAdvisoryConsoleError);
    const unexpectedConsoleErrors = runtime.consoleErrors.filter((message) => !isAdvisoryConsoleError(message));
    const violations = [];
    const warnings = [];
    if (!response.ok) violations.push(`HTTP ${response.status}`);
    if (!runtime.hasMainOrShell) violations.push("missing main/shell landmark");
    if (runtime.horizontalOverflow) violations.push("horizontal overflow");
    if (unexpectedConsoleErrors.length) violations.push(`${unexpectedConsoleErrors.length} unexpected console error(s)`);
    if (advisoryConsoleErrors.length) warnings.push(`${advisoryConsoleErrors.length} indexer unavailable console error(s)`);
    if (runtime.pageErrors.length) violations.push(`${runtime.pageErrors.length} page error(s)`);

    return {
      surface: surface.name,
      route,
      width,
      statusCode: response.status,
      title: runtime.title,
      reducedMotion: runtime.reducedMotion,
      mainExists: runtime.mainExists,
      hasMainOrShell: runtime.hasMainOrShell,
      horizontalOverflow: runtime.horizontalOverflow,
      viewportWidth: runtime.viewportWidth,
      scrollWidth: runtime.scrollWidth,
      overflowElements: runtime.overflowElements,
      consoleErrors: runtime.consoleErrors,
      advisoryConsoleErrors,
      unexpectedConsoleErrors,
      pageErrors: runtime.pageErrors,
      webMcp: runtime.webMcp,
      artifacts: {
        screenshot: path.relative(repoRoot, screenshotPath),
        accessibilitySummary: path.relative(repoRoot, axPath),
      },
      violations,
      warnings,
    };
  } finally {
    await client.send("Target.closeTarget", { targetId: target.targetId }).catch(() => {});
  }
}

async function main() {
  ensureBuildOutputs();
  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(artifactDir, { recursive: true });

  const servedSurfaces = [];
  const chrome = await launchChrome();
  const client = new CdpClient(chrome.wsUrl);
  const results = [];
  const llmsTxt = {};

  try {
    for (const surface of surfaces) {
      servedSurfaces.push(await startStaticServer(surface));
    }

    for (const surface of servedSurfaces) {
      llmsTxt[surface.name] = await auditLlmsTxt(surface);
      for (const route of surface.routes) {
        for (const width of widths) {
          const result = await verifyRoute(client, surface, route, width);
          results.push(result);
          const status = result.violations.length
            ? `FAIL ${result.violations.join(", ")}`
            : result.warnings.length
              ? `warn ${result.warnings.join(", ")}`
              : "ok";
          console.log(`[agentic-browser-proof] ${surface.name}${route} @${width}: ${status}`);
        }
      }
    }

    const report = {
      generatedAt: new Date().toISOString(),
      proofBoundary:
        "Built-bundle route-entry, console, accessibility-tree summary, reduced-motion, horizontal-overflow, llms.txt, and WebMCP discovery proof. This does not prove seeded/data-rich visual correctness.",
      widths,
      surfaces: servedSurfaces.map((surface) => ({
        name: surface.name,
        origin: surface.origin,
        publicRoot: surface.publicRoot,
        spaFallback: surface.spaFallback,
        routes: surface.routes,
      })),
      llmsTxt,
      results,
    };
    const reportPath = path.join(artifactDir, "report.json");
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    const hardCount = results.reduce((sum, result) => sum + result.violations.length, 0);
    const warningCount = results.reduce((sum, result) => sum + result.warnings.length, 0);
    const llmsFailures = Object.entries(llmsTxt).filter(([, result]) => result.status === "missing" || result.status === "error");
    console.log(
      `[agentic-browser-proof] wrote ${path.relative(repoRoot, reportPath)} with ${hardCount} route violation(s), ${warningCount} warning(s), and ${llmsFailures.length} llms.txt issue(s).`,
    );
    if (hardCount > 0 || llmsFailures.length > 0) process.exitCode = 1;
  } finally {
    client.close();
    await chrome.close();
    await Promise.all(servedSurfaces.map((surface) => surface.close()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
