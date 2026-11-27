/**
 * Global teardown for E2E tests
 *
 * - Cleans up any test data or resources
 * - Can be extended for test isolation cleanup
 */
async function globalTeardown() {
  console.log("\n🧹 Running global test teardown...");

  console.log("✅ Test teardown complete\n");
}

export default globalTeardown;
