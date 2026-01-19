#!/usr/bin/env tsx

/**
 * Green Goods E2E Test Runner
 *
 * Provides convenient commands for running different test suites.
 * Run with: bun tests/run-tests.ts <command>
 */
import { execSync } from "node:child_process";
import * as http from "node:http";
import * as https from "node:https";

console.log("🚀 Green Goods E2E Test Runner");
console.log("=====================================\n");

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0] || "help";

interface ServiceCheckResult {
  ok: boolean;
}

interface ServiceResults {
  indexer: boolean;
  client: boolean;
  admin: boolean;
}

/**
 * Run a command and log output
 */
function runCommand(cmd: string, description: string): void {
  console.log(`📋 ${description}`);
  console.log(`🔧 Command: ${cmd}\n`);

  try {
    execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
    console.log(`\n✅ ${description} completed successfully!\n`);
  } catch (error) {
    const exitCode = error instanceof Error && "status" in error ? (error as any).status : 1;
    console.log(`\n❌ ${description} failed with exit code ${exitCode}\n`);
    process.exit(exitCode);
  }
}

/**
 * Check if services are running
 */
async function checkServices(): Promise<boolean> {
  console.log("🔍 Checking if services are running...\n");

  const results: ServiceResults = {
    indexer: false,
    client: false,
    admin: false,
  };

  // Check indexer (GraphQL)
  try {
    const indexerCheck = await new Promise<ServiceCheckResult>((resolve) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: 8080,
          path: "/v1/graphql",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          timeout: 5000,
        },
        (res) => resolve({ ok: res.statusCode === 200 })
      );
      req.on("error", () => resolve({ ok: false }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false });
      });
      req.write(JSON.stringify({ query: "query { __typename }" }));
      req.end();
    });
    results.indexer = indexerCheck.ok;
    console.log(results.indexer ? "  ✅ Indexer (port 8080)" : "  ❌ Indexer (port 8080)");
  } catch {
    console.log("  ❌ Indexer (port 8080)");
  }

  // Check client (HTTPS)
  try {
    const clientCheck = await new Promise<ServiceCheckResult>((resolve) => {
      const req = https.request(
        {
          hostname: "localhost",
          port: 3001,
          path: "/",
          method: "GET",
          timeout: 5000,
          rejectUnauthorized: false, // Accept self-signed certs
        },
        (res) => resolve({ ok: res.statusCode! < 500 })
      );
      req.on("error", () => resolve({ ok: false }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false });
      });
      req.end();
    });
    results.client = clientCheck.ok;
    console.log(results.client ? "  ✅ Client (port 3001)" : "  ❌ Client (port 3001)");
  } catch {
    console.log("  ❌ Client (port 3001)");
  }

  // Check admin (HTTPS)
  try {
    const adminCheck = await new Promise<ServiceCheckResult>((resolve) => {
      const req = https.request(
        {
          hostname: "localhost",
          port: 3002,
          path: "/",
          method: "GET",
          timeout: 5000,
          rejectUnauthorized: false,
        },
        (res) => resolve({ ok: res.statusCode! < 500 })
      );
      req.on("error", () => resolve({ ok: false }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false });
      });
      req.end();
    });
    results.admin = adminCheck.ok;
    console.log(results.admin ? "  ✅ Admin (port 3002)" : "  ❌ Admin (port 3002)");
  } catch {
    console.log("  ❌ Admin (port 3002)");
  }

  console.log("");

  const allReady = results.indexer && results.client && results.admin;
  if (allReady) {
    console.log("🎯 All services are ready for testing!\n");
  } else {
    console.log("💡 Start missing services with: bun dev\n");
  }

  return allReady;
}

/**
 * Main command handler
 */
async function main(): Promise<void> {
  switch (command) {
    // ─────────────────────────────────────────────────────────────────────────
    // SMOKE TESTS (fast validation)
    // ─────────────────────────────────────────────────────────────────────────
    case "smoke":
      console.log("🔍 Running smoke tests...\n");
      runCommand(
        "npx playwright test tests/specs/client.smoke.spec.ts tests/specs/admin.smoke.spec.ts --project=chromium",
        "Smoke tests (client + admin)"
      );
      break;

    case "smoke:client":
      console.log("🔍 Running client smoke tests...\n");
      runCommand(
        "npx playwright test tests/specs/client.smoke.spec.ts --project=chromium",
        "Client smoke tests"
      );
      break;

    case "smoke:admin":
      console.log("🔍 Running admin smoke tests...\n");
      runCommand(
        "npx playwright test tests/specs/admin.smoke.spec.ts --project=chromium",
        "Admin smoke tests"
      );
      break;

    // ─────────────────────────────────────────────────────────────────────────
    // MOBILE TESTS
    // ─────────────────────────────────────────────────────────────────────────
    case "mobile":
      console.log("📱 Running mobile tests (Android + iOS)...\n");
      runCommand(
        "npx playwright test tests/specs/client.smoke.spec.ts --project=mobile-chrome --project=mobile-safari",
        "Mobile tests (Android + iOS)"
      );
      break;

    case "mobile:android":
      console.log("🤖 Running Android tests...\n");
      runCommand(
        "npx playwright test tests/specs/client.smoke.spec.ts --project=mobile-chrome",
        "Android Chrome tests"
      );
      break;

    case "mobile:ios":
      console.log("🍎 Running iOS tests...\n");
      runCommand(
        "npx playwright test tests/specs/client.smoke.spec.ts --project=mobile-safari",
        "iOS Safari tests"
      );
      break;

    // ─────────────────────────────────────────────────────────────────────────
    // ALL TESTS
    // ─────────────────────────────────────────────────────────────────────────
    case "all":
      console.log("🧪 Running all tests...\n");
      runCommand("npx playwright test", "All E2E tests");
      break;

    // ─────────────────────────────────────────────────────────────────────────
    // DEBUGGING
    // ─────────────────────────────────────────────────────────────────────────
    case "debug":
      runCommand("npx playwright test --debug", "Debug mode");
      break;

    case "ui":
      runCommand("npx playwright test --ui", "Playwright UI");
      break;

    case "headed":
      runCommand("npx playwright test --headed", "Headed mode (visible browser)");
      break;

    // ─────────────────────────────────────────────────────────────────────────
    // SERVICE MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────
    case "check":
      await checkServices();
      break;

    case "with-services":
      console.log("🚀 Running tests with automatic service startup...\n");
      runCommand(
        "SKIP_WEBSERVER=false npx playwright test tests/specs/client.smoke.spec.ts tests/specs/admin.smoke.spec.ts --project=chromium",
        "Smoke tests with auto-start"
      );
      break;

    case "without-services":
      console.log("🏃 Running tests (services must be running)...\n");
      await checkServices();
      runCommand(
        "SKIP_WEBSERVER=true SKIP_HEALTH_CHECK=true npx playwright test tests/specs/client.smoke.spec.ts tests/specs/admin.smoke.spec.ts --project=chromium",
        "Smoke tests (no auto-start)"
      );
      break;

    // ─────────────────────────────────────────────────────────────────────────
    // HELP
    // ─────────────────────────────────────────────────────────────────────────
    case "help":
    default:
      console.log(`Usage: bun tests/run-tests.ts [command]

Available commands:

  SMOKE TESTS (fast validation):
    smoke          - Run client + admin smoke tests
    smoke:client   - Run client smoke tests only
    smoke:admin    - Run admin smoke tests only

  MOBILE:
    mobile         - Run mobile tests (Android + iOS)
    mobile:android - Run Android Chrome tests only
    mobile:ios     - Run iOS Safari tests only

  ALL TESTS:
    all            - Run all E2E tests

  DEBUGGING:
    debug          - Run in debug mode
    ui             - Open Playwright UI
    headed         - Run with visible browser

  SERVICE MANAGEMENT:
    check          - Check if services are running
    with-services  - Start services and run tests
    without-services - Run tests (services must be running)

  OTHER:
    help           - Show this help message

Quick start:
  1. Start services: bun dev (in another terminal)
  2. Check services: bun tests/run-tests.ts check
  3. Run smoke tests: bun tests/run-tests.ts smoke

Platform-specific:
  - Android: Uses passkey auth (virtual WebAuthn)
  - iOS: Uses wallet auth (storage injection)
  - Admin: Uses wallet auth (storage injection)

For CI:
  SKIP_WEBSERVER=false npx playwright test
`);
      break;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
