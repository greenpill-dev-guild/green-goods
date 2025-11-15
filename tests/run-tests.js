#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");

console.log("🚀 Green Goods E2E Test Runner");
console.log("=====================================\n");

// Check if playwright is installed
try {
  execSync("npx playwright --version", { stdio: "ignore" });
} catch (error) {
  console.log("❌ Playwright not found. Installing...");
  execSync("npx playwright install", { stdio: "inherit" });
}

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0] || "help";

function runCommand(cmd, description) {
  console.log(`📋 ${description}`);
  console.log(`🔧 Command: ${cmd}\n`);

  try {
    execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
    console.log(`✅ ${description} completed successfully!\n`);
  } catch (error) {
    console.log(`❌ ${description} failed with exit code ${error.status}\n`);
    process.exit(error.status);
  }
}

async function checkServices() {
  console.log("🔍 Checking if services are running...\n");

  let servicesReady = false;

  // Check indexer with GraphQL endpoint
  try {
    const { execSync } = require("child_process");

    // Try curl first, fallback to node fetch-like approach
    let indexerResult;
    try {
      indexerResult = execSync(
        'curl -s -X POST http://localhost:8080/v1/graphql -H "Content-Type: application/json" -d \'{"query":"query { __typename }"}\'',
        { timeout: 5000, encoding: "utf8" }
      );
    } catch (curlError) {
      // Fallback: use node to check port
      indexerResult = execSync(
        "node -e \"const http = require('http'); const req = http.request({hostname: 'localhost', port: 8080, path: '/v1/graphql', method: 'POST'}, (res) => { console.log(res.statusCode); }); req.on('error', () => { process.exit(1); }); req.end();\"",
        { timeout: 5000, encoding: "utf8" }
      );
    }

    if (indexerResult && !indexerResult.includes("curl:") && !indexerResult.includes("error")) {
      console.log("✅ Indexer is running on port 8080 (GraphQL responding)");
    } else {
      console.log("⚠️  Indexer not responding on port 8080");
    }
  } catch (error) {
    console.log("⚠️  Indexer not running on port 8080");
  }

  // Check client with HTTP request - secure health check approach
  try {
    const http = require("http");

    const clientStatus = await new Promise((resolve) => {
      // Try HTTP first (common for health checks), fallback to HTTPS if needed
      const req = http.get(
        "http://localhost:3001/",
        {
          timeout: 5000,
        },
        (res) => {
          resolve({ status: res.statusCode, success: true, protocol: "HTTP" });
        }
      );

      req.on("error", () => {
        // If HTTP fails, try HTTPS but with proper certificate handling
        const https = require("https");
        const httpsReq = https.get(
          "https://localhost:3001/",
          {
            timeout: 5000,
            // Optionally, provide CA in test environment to support self-signed cert
            ...(process.env.NODE_ENV === "test" &&
              process.env.LOCAL_CA && {
                ca: fs.readFileSync(process.env.LOCAL_CA),
              }),
          },
          (res) => {
            resolve({ status: res.statusCode, success: true, protocol: "HTTPS" });
          }
        );

        httpsReq.on("error", () => {
          resolve({ status: 0, success: false });
        });

        httpsReq.on("timeout", () => {
          httpsReq.destroy();
          resolve({ status: 0, success: false });
        });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({ status: 0, success: false });
      });
    });

    if (clientStatus.success && clientStatus.status >= 200 && clientStatus.status < 500) {
      console.log(
        `✅ Client is running on port 3001 (${clientStatus.protocol} ${clientStatus.status})`
      );
      servicesReady = true;
    } else if (clientStatus.success) {
      console.log(`⚠️  Client responding with status: ${clientStatus.status}`);
    } else {
      console.log("⚠️  Client not responding on port 3001");
    }
  } catch (error) {
    console.log("⚠️  Client not running on port 3001");
  }

  if (servicesReady) {
    console.log("🎯 Services are ready for testing!\n");
  } else {
    console.log("💡 Start services with: bun dev\n");
  }

  return servicesReady;
}

async function main() {
  switch (command) {
    case "smoke":
      console.log("🔍 Running smoke tests (includes service connectivity check)...\n");
      runCommand("npx playwright test tests/specs/smoke --project=chromium", "Running smoke tests");
      break;

    case "quick":
      console.log("⚡ Running quick validation tests (smoke + basic integration)...\n");
      runCommand(
        "npx playwright test tests/specs/smoke tests/specs/integration/basic-integration.spec.ts --project=chromium",
        "Running quick validation tests"
      );
      break;

    case "mobile":
      runCommand(
        "npx playwright test --project=mobile-chrome --project=mobile-safari",
        "Running mobile browser tests"
      );
      break;

    case "integration":
      runCommand("npx playwright test tests/specs/integration", "Running integration tests");
      break;

    case "pwa":
      runCommand(
        "ENABLE_PWA_E2E=true npx playwright test tests/specs/pwa",
        "Running PWA tests with service worker enabled"
      );
      break;

    case "performance":
      runCommand("npx playwright test tests/specs/performance", "Running performance tests");
      break;

    case "blockchain":
      runCommand("npx playwright test tests/specs/blockchain", "Running blockchain tests");
      break;

    case "all":
      runCommand("npx playwright test", "Running all E2E tests");
      break;

    case "debug":
      runCommand("npx playwright test --debug", "Running in debug mode");
      break;

    case "ui":
      runCommand("npx playwright test --ui", "Opening Playwright UI");
      break;

    case "check":
      await checkServices();
      break;

    case "with-services":
      console.log("🚀 Starting services and running tests...\n");
      runCommand(
        "SKIP_WEBSERVER=false npx playwright test tests/specs/smoke",
        "Running tests with automatic service startup"
      );
      break;

    case "without-services":
      console.log("🏃 Running tests assuming services are already running...\n");
      await checkServices();
      runCommand(
        "SKIP_WEBSERVER=true SKIP_HEALTH_CHECK=true npx playwright test tests/specs/smoke",
        "Running tests without service startup"
      );
      break;

    case "help":
    default:
      console.log(`Usage: node tests/run-tests.js [command]

Available commands:
  smoke          - Run basic smoke tests (fastest)
  quick          - Run smoke + basic integration tests
  mobile         - Run mobile browser tests
  integration    - Run integration tests
  pwa            - Run PWA-specific tests
  performance    - Run performance tests
  blockchain     - Run blockchain integration tests
  all            - Run all tests
  debug          - Run in debug mode
  ui             - Open Playwright UI
  check          - Check if services are running
  with-services  - Start services automatically and run tests
  without-services - Run tests assuming services are already running
  help           - Show this help message

Debugging:
  node tests/test-connectivity.js - Detailed connectivity debugging

Quick start:
  1. Start services: bun dev (in another terminal)
  2. Check services: node tests/run-tests.js check
  3. Run smoke tests: node tests/run-tests.js smoke
  4. Run all tests: node tests/run-tests.js all

If you get "net::ERR_EMPTY_RESPONSE" errors:
  - Services are not running on ports 3001/8080
  - See tests/QUICK_START.md for detailed fix instructions

For development:
  - Use 'smoke' for quick validation
  - Use 'quick' for basic functionality check
  - Use 'mobile' to test PWA features
  - Use 'debug' to troubleshoot issues
`);
      break;
  }
}

main().catch(console.error);
