#!/usr/bin/env node

/**
 * Non-mutating web stack smoke check.
 *
 * Run after `bun run dev:web` is starting or already running. The script first
 * runs the web doctor, then verifies that client/admin/docs respond locally.
 */

import http from "node:http";
import https from "node:https";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const services = [
  {
    name: "client",
    port: 3001,
    urls: ["https://localhost:3001", "http://localhost:3001"],
  },
  {
    name: "admin",
    port: 3002,
    urls: ["https://localhost:3002", "http://localhost:3002"],
  },
  {
    name: "docs",
    port: 3003,
    urls: ["http://localhost:3003", "https://localhost:3003"],
  },
];

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(
    "Usage: node scripts/dev-smoke-web.js [--json] [--skip-doctor] [--timeout seconds]\n"
  );
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = {
    json: false,
    skipDoctor: false,
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

  const result = spawnSync(process.execPath, ["scripts/dev-doctor.js", "--profile", "web", "--json"], {
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

function requestUrl(url, timeoutMs) {
  const parsed = new URL(url);
  const client = parsed.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    const request = client.get(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname || "/",
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (response) => {
        response.resume();
        resolve({
          ok: true,
          url,
          statusCode: response.statusCode,
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error(`Timed out after ${timeoutMs}ms`));
    });
    request.on("error", (error) => {
      resolve({
        ok: false,
        url,
        error: error.code || error.message,
      });
    });
  });
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

const failures = (doctor.ready ? 0 : 1) + serviceResults.filter((service) => !service.ready).length;
const payload = {
  profile: "web",
  doctor,
  services: serviceResults,
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
