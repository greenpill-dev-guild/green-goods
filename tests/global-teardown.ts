import type { FullConfig } from "@playwright/test";

async function globalTeardown(config: FullConfig) {
  console.log("🧹 Running global test teardown...");

  // Clean up any test data or resources
  // For now, just log completion
  console.log("✅ Test teardown complete");
}

export default globalTeardown;
