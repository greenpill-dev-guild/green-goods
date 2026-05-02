#!/usr/bin/env node

/**
 * Non-mutating web stack smoke check.
 *
 * Run after `bun run dev:web` is starting or already running. The script first
 * runs the web doctor, then verifies that client/admin/docs/storybook respond locally.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requestUrl, reexecUnderSystemNodeIfNeeded } from "../lib/dev-shared.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

reexecUnderSystemNodeIfNeeded({
  scriptPath: __filename,
  sentinel: "GREEN_GOODS_SMOKE_NODE_REEXEC",
  cwd: projectRoot,
});

const services = [
  {
    name: "client",
    port: 3001,
    urls: ["https://localhost:3001", "http://localhost:3001"],
    hmr: "vite",
  },
  {
    name: "admin",
    port: 3002,
    urls: ["https://localhost:3002", "http://localhost:3002"],
    hmr: "vite",
  },
  {
    name: "docs",
    port: 3003,
    urls: ["http://localhost:3003", "https://localhost:3003"],
  },
  {
    name: "storybook",
    port: 6006,
    urls: ["http://localhost:6006"],
    hmr: "vite",
  },
];

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(
    "Usage: node scripts/dev/smoke-web.js [--json] [--skip-doctor] [--skip-hmr] [--timeout seconds]\n"
  );
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = {
    json: false,
    skipDoctor: false,
    skipHmr: false,
    timeoutMs: 60_000,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--skip-doctor") {
      options.skipDoctor = true;
      continue;
    }
    if (arg === "--skip-hmr") {
      options.skipHmr = true;
      continue;
    }
    if (arg === "--timeout") {
      const seconds = Number.parseInt(argv[++index] || "", 10);
      if (!Number.isFinite(seconds) || seconds <= 0) usage(1);
      options.timeoutMs = seconds * 1000;
      continue;
    }
    if (arg.startsWith("--timeout=")) {
      const seconds = Number.parseInt(arg.slice("--timeout=".length), 10);
      if (!Number.isFinite(seconds) || seconds <= 0) usage(1);
      options.timeoutMs = seconds * 1000;
      continue;
    }

    process.stderr.write(`Unknown option: ${arg}\n`);
    usage(1);
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));

function runDoctor() {
  if (options.skipDoctor) {
    return {
      level: "skipped",
      ready: true,
      detail: "Skipped by --skip-doctor.",
    };
  }

  const result = spawnSync(process.execPath, ["scripts/dev/doctor.js", "--profile", "web", "--json"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  let payload = null;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    // Preserve the raw process outcome below when JSON parsing fails.
  }

  const summary = payload?.summary;
  const failures = Array.isArray(payload?.results)
    ? payload.results.filter((item) => item.level === "fail")
    : [];

  return {
    level: result.status === 0 ? "pass" : "fail",
    ready: result.status === 0,
    detail:
      summary && typeof summary.failures === "number"
        ? `${summary.failures} required check(s), ${summary.warnings} warning(s).`
        : "Doctor did not return parseable JSON.",
    failures: failures.map((failure) => ({
      title: failure.title,
      detail: failure.detail,
      fix: failure.fix,
      check: failure.check,
    })),
    payload,
    stdout: payload ? undefined : result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

async function waitForService(service, deadlineMs) {
  const attempts = [];

  while (Date.now() < deadlineMs) {
    for (const url of service.urls) {
      const attempt = await requestUrl(url, 2500);
      attempts.push(attempt);
      if (attempt.ok) {
        return {
          name: service.name,
          port: service.port,
          level: "pass",
          ready: true,
          url: attempt.url,
          statusCode: attempt.statusCode,
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const lastAttempts = attempts.slice(-service.urls.length).map((attempt) => ({
    url: attempt.url,
    error: attempt.error || `HTTP ${attempt.statusCode}`,
  }));

  return {
    name: service.name,
    port: service.port,
    level: "fail",
    ready: false,
    detail: `No response on port ${service.port}.`,
    attempts: lastAttempts,
    fix: "Start or restart the web stack with bun run dev:web, then rerun bun run dev:smoke:web.",
  };
}

async function checkViteHmr(service, serviceResult, browser) {
  if (!serviceResult?.ready) {
    return {
      name: service.name,
      level: "skipped",
      ready: true,
      detail: "Service readiness check failed; HMR check skipped.",
    };
  }

  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const events = [];
  page.on("console", (message) => events.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => events.push(`pageerror: ${error.message}`));

  try {
    await page.goto(serviceResult.url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(3_500);
  } catch (error) {
    return {
      name: service.name,
      level: "fail",
      ready: false,
      url: serviceResult.url,
      detail: `Browser HMR probe failed: ${error.message}`,
      fix: "Restart the web stack with bun run dev:web and rerun bun run dev:smoke:web.",
    };
  } finally {
    await page.close();
  }

  const failure = events.find((event) =>
    /\[vite\] failed to connect to websocket|WebSocket connection .* failed|ERR_SSL_PROTOCOL_ERROR|server connection lost/i.test(
      event
    )
  );
  const connected = events.some((event) => /\[vite\] connected\./i.test(event));

  if (!failure && connected) {
    return {
      name: service.name,
      level: "pass",
      ready: true,
      url: serviceResult.url,
      detail: "Vite HMR websocket connected in the browser.",
    };
  }

  return {
    name: service.name,
    level: "fail",
    ready: false,
    url: serviceResult.url,
    detail: failure || "Browser did not report a Vite HMR connection.",
    fix: "Run the Vite dev server under real Node instead of Bun, then rerun bun run dev:smoke:web.",
  };
}

async function runHmrChecks(serviceResults) {
  if (options.skipHmr) {
    return [
      {
        name: "vite",
        level: "skipped",
        ready: true,
        detail: "Skipped by --skip-hmr.",
      },
    ];
  }

  let chromium;
  try {
    ({ chromium } = await import("@playwright/test"));
  } catch (error) {
    return [
      {
        name: "vite",
        level: "fail",
        ready: false,
        detail: `Unable to load Playwright for HMR smoke: ${error.message}`,
        fix: "Install repo dependencies with bun install, then rerun bun run dev:smoke:web.",
      },
    ];
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const checks = [];
    for (const service of services.filter((item) => item.hmr === "vite")) {
      const serviceResult = serviceResults.find((result) => result.name === service.name);
      checks.push(await checkViteHmr(service, serviceResult, browser));
    }
    return checks;
  } catch (error) {
    return [
      {
        name: "vite",
        level: "fail",
        ready: false,
        detail: `Browser HMR smoke failed: ${error.message}`,
        fix: "Ensure Playwright browsers are installed and rerun bun run dev:smoke:web.",
      },
    ];
  } finally {
    await browser?.close();
  }
}

function printText(payload) {
  console.log("\nGreen Goods Web Smoke\n");

  const doctorMark = payload.doctor.ready ? "PASS" : payload.doctor.level === "skipped" ? "SKIP" : "FAIL";
  console.log(`[${doctorMark}] Web doctor`);
  if (payload.doctor.detail) console.log(`       ${payload.doctor.detail}`);
  for (const failure of payload.doctor.failures || []) {
    console.log(`       ${failure.title}`);
    if (failure.detail) console.log(`       Detail: ${failure.detail}`);
    if (failure.fix) console.log(`       Fix: ${failure.fix}`);
  }

  for (const service of payload.services) {
    if (service.ready) {
      console.log(`[PASS] ${service.name} responded`);
      console.log(`       ${service.url} (${service.statusCode})`);
      continue;
    }

    console.log(`[FAIL] ${service.name} did not respond`);
    console.log(`       ${service.detail}`);
    if (service.fix) console.log(`       Fix: ${service.fix}`);
  }

  for (const hmr of payload.hmr || []) {
    if (hmr.ready) {
      const mark = hmr.level === "skipped" ? "SKIP" : "PASS";
      console.log(`[${mark}] ${hmr.name} HMR`);
      if (hmr.detail) console.log(`       ${hmr.detail}`);
      continue;
    }

    console.log(`[FAIL] ${hmr.name} HMR`);
    console.log(`       ${hmr.detail}`);
    if (hmr.fix) console.log(`       Fix: ${hmr.fix}`);
  }

  if (payload.summary.ready) {
    console.log("\nWeb stack smoke passed.");
    return;
  }

  console.log(`\n${payload.summary.failures} smoke check(s) failed.`);
}

const doctor = runDoctor();
const serviceResults = doctor.ready
  ? await Promise.all(
      services.map((service) => waitForService(service, Date.now() + options.timeoutMs))
    )
  : [];
const hmrResults = doctor.ready ? await runHmrChecks(serviceResults) : [];

const failures =
  (doctor.ready ? 0 : 1) +
  serviceResults.filter((service) => !service.ready).length +
  hmrResults.filter((hmr) => !hmr.ready).length;
const payload = {
  profile: "web",
  doctor,
  services: serviceResults,
  hmr: hmrResults,
  summary: {
    ready: failures === 0,
    failures,
    timeoutMs: options.timeoutMs,
  },
  entrypoints: {
    start: "bun run dev:web",
    smoke: "bun run dev:smoke:web",
    doctor: "bun run dev:doctor -- --profile web",
    stop: "bun run dev:stop",
  },
};

if (options.json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  printText(payload);
}

if (!payload.summary.ready) {
  process.exitCode = 1;
}
