import { chromium, type FullConfig, type Page } from "@playwright/test";
import { resolvePlaywrightApps, shouldUsePlaywrightIndexer } from "./fixtures/playwright-services";

function envFlag(name: string): boolean {
  return process.env[name]?.toLowerCase() === "true";
}

const ADMIN_WARMUP_TIMEOUT_MS = 120_000;

/**
 * A fresh Vite dev server compiles the admin root on its first page load, which
 * held the boot shell past 15 seconds for whichever spec ran first in CI. Boot
 * the admin once here so every spec starts against a compiled module graph.
 * Never throws: if the warm-up cannot finish, the specs report the real failure.
 */
async function warmAdminBoot(page: Page, adminUrl: string): Promise<void> {
  const startedAt = Date.now();
  try {
    await page.goto(`${adminUrl}/hub`, {
      waitUntil: "domcontentloaded",
      timeout: ADMIN_WARMUP_TIMEOUT_MS,
    });
    // The boot shell is replaced once `import("./AdminRoot")` resolves and the
    // workspace renders, or by the recovery screen if that import fails.
    await page.waitForFunction(
      () => {
        const root = document.getElementById("root");
        return Boolean(
          root?.firstElementChild && !root.querySelector('[data-component="AdminBootShell"]')
        );
      },
      undefined,
      { timeout: ADMIN_WARMUP_TIMEOUT_MS }
    );
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (await page.locator('[data-component="AdminBootRecovery"]').count()) {
      console.log(`  ⚠️  Admin warm-up reached the boot recovery screen after ${seconds}s`);
    } else {
      console.log(`  🔥 Admin (port 3002) - booted once in ${seconds}s to warm the dev server`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    console.log(
      `  ⚠️  Admin warm-up did not finish (${message}); the first spec may pay the compile`
    );
  }
}

/**
 * Global setup for E2E tests
 *
 * - Sets environment variables for test configuration
 * - Performs health checks on services (client, admin, indexer)
 * - Boots the admin once so its dev server has compiled it before the first spec
 * - Can be extended to set up virtual WebAuthn authenticator state
 */
async function globalSetup(config: FullConfig) {
  console.log("🚀 Starting global test setup...\n");

  const selectedApps = resolvePlaywrightApps({ playwrightApp: process.env.PLAYWRIGHT_APP });
  const shouldCheckIndexer = shouldUsePlaywrightIndexer();

  // In CI, Vite skips mkcert and runs on HTTP instead of HTTPS
  const isCI = process.env.CI === "true";
  const protocol = isCI ? "http" : "https";

  // Set test environment variables
  process.env.TEST_INDEXER_URL = "http://localhost:3006/v1/graphql";
  process.env.TEST_CLIENT_URL = `${protocol}://localhost:3001`;
  process.env.TEST_ADMIN_URL = `${protocol}://localhost:3002`;
  process.env.TEST_CHAIN_ID = "11155111"; // Sepolia

  // Enable service worker only for PWA tests
  if (process.env.ENABLE_PWA_E2E === "true") {
    process.env.VITE_ENABLE_SW_DEV = "true";
  }

  // Skip health check if requested
  if (envFlag("SKIP_HEALTH_CHECK")) {
    console.log("⏭️  Skipping health check (SKIP_HEALTH_CHECK=true)\n");
    console.log("✅ Global setup complete\n");
    return;
  }

  // Run health checks
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true, // Accept self-signed certs from mkcert
  });
  const page = await context.newPage();

  try {
    console.log("📊 Checking service availability...\n");

    if (shouldCheckIndexer) {
      try {
        const indexerResponse = await page.request.post("http://localhost:3006/v1/graphql", {
          data: { query: `query { __schema { types { name } } }` },
          headers: { "Content-Type": "application/json" },
          timeout: 5000,
        });

        if (indexerResponse.ok()) {
          console.log("  ✅ Indexer (port 3006) - available");
        } else {
          console.log("  ⚠️  Indexer (port 3006) - responded with error");
        }
      } catch {
        console.log("  ⚠️  Indexer (port 3006) - not available (will be started by webServer)");
      }
    }

    if (selectedApps.client) {
      try {
        await page.goto(`${protocol}://localhost:3001`, { timeout: 5000 });
        console.log("  ✅ Client (port 3001) - available");
      } catch {
        console.log("  ⚠️  Client (port 3001) - not available (will be started by webServer)");
      }
    }

    if (selectedApps.admin) {
      try {
        await page.goto(`${protocol}://localhost:3002`, { timeout: 5000 });
        console.log("  ✅ Admin (port 3002) - available");
      } catch {
        console.log("  ⚠️  Admin (port 3002) - not available (will be started by webServer)");
      }
      await warmAdminBoot(page, `${protocol}://localhost:3002`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`\n⚠️  Health check failed: ${message}`);
    console.log("   Tests will attempt to start services via webServer config\n");
  } finally {
    await browser.close();
  }

  console.log("\n✅ Global setup complete\n");
}

export default globalSetup;
