#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
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

function isStableBraveExecutablePath(candidate) {
  return path.basename(candidate || "") === "Brave Browser" && !/beta|nightly|dev|chrome|chromium|edge/i.test(candidate || "");
}

function findBraveBinary() {
  for (const envName of ["BRAVE_BIN", "GREEN_GOODS_BRAVE_BIN"]) {
    const explicit = process.env[envName];
    if (explicit && !isStableBraveExecutablePath(explicit)) {
      throw new Error(
        `${envName} must point to stable Brave Browser. Brave Beta, Brave Nightly, Google Chrome, Chrome for Testing, Chromium, and Edge are not valid Green Goods browser-proof targets.`,
      );
    }
  }

  const candidates = [
    process.env.BRAVE_BIN,
    process.env.GREEN_GOODS_BRAVE_BIN,
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ].filter(Boolean);
  return candidates.find((candidate) => existsExecutable(candidate) && isStableBraveExecutablePath(candidate)) || "";
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

async function launchBrave() {
  const braveBinary = findBraveBinary();
  if (!braveBinary) {
    throw new Error("No Brave binary found for browser proof. Install Brave or set GREEN_GOODS_BRAVE_BIN.");
  }

  const userDataDir = path.join(tmpdir(), `green-goods-agentic-browser-proof-${process.pid}`);
  const child = spawn(braveBinary, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-extensions",
    "--enable-features=WebMCPTesting,DevToolsWebMCPSupport",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  const wsUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for Brave DevTools endpoint.")), 15000);
    child.stderr.on("data", (chunk) => {
      const match = chunk.toString().match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Brave exited before DevTools endpoint was ready: ${code}`));
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
        const hasNativeModelContext = 'modelContext' in navigator;
        window.__agenticProof = {
          consoleErrors: [],
          pageErrors: [],
          webMcp: {
            mode: hasNativeModelContext ? 'native' : 'injected-model-context',
            registeredTools: []
          }
        };
        if (!hasNativeModelContext) {
          Object.defineProperty(navigator, 'modelContext', {
            configurable: true,
            value: {
              registerTool(tool) {
                window.__agenticProof.webMcp.registeredTools.push({
                  name: tool?.name || '',
                  description: tool?.description || '',
                  inputSchema: tool?.inputSchema || null,
                  annotations: tool?.annotations || null
                });
              }
            }
          });
        }
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
      (async () => {
        const proof = window.__agenticProof || { consoleErrors: [], pageErrors: [] };
        const modelContext = 'modelContext' in navigator ? navigator.modelContext : undefined;
        const registeredPublicTools = Array.isArray(window.__GREEN_GOODS_WEBMCP_PUBLIC_TOOLS__)
          ? window.__GREEN_GOODS_WEBMCP_PUBLIC_TOOLS__
          : [];
        const proofWebMcp = proof.webMcp || { mode: 'unknown', registeredTools: [] };
        const nativeTools = typeof modelContext?.getTools === 'function'
          ? await modelContext.getTools()
              .then((tools) => tools.map((tool) => ({
                name: tool?.name || '',
                description: tool?.description || '',
                origin: tool?.origin || ''
              })))
              .catch((error) => [{ error: String(error?.message || error) }])
          : [];
        const declarativeTools = [...document.querySelectorAll('form[toolname], form[tooldescription]')].map((form) => ({
          name: form.getAttribute('toolname') || '',
          description: form.getAttribute('tooldescription') || ''
        }));
        const hasRegisteredTools = registeredPublicTools.length > 0 || proofWebMcp.registeredTools.length > 0 || nativeTools.length > 0;
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
            status: hasRegisteredTools
              ? proofWebMcp.mode === 'injected-model-context'
                ? 'registered_with_injected_model_context'
                : 'detected'
              : proofWebMcp.mode === 'injected-model-context'
                ? 'no_tools_registered_with_injected_model_context'
              : Boolean(modelContext) || declarativeTools.length > 0
                ? 'detected'
                : 'not_supported',
            proofMode: proofWebMcp.mode,
            navigatorModelContext: Boolean(modelContext),
            registerToolType: typeof modelContext?.registerTool,
            registeredPublicTools,
            registeredTools: proofWebMcp.registeredTools,
            nativeTools,
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
  const browser = await launchBrave();
  const client = new CdpClient(browser.wsUrl);
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
    await browser.close();
    await Promise.all(servedSurfaces.map((surface) => surface.close()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
