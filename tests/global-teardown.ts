/**
 * Global teardown for E2E tests
 *
 * - Cleans up any test data or resources
 * - Can be extended for test isolation cleanup
 */
async function globalTeardown() {
  console.log("\n🧹 Running global test teardown...");

  // Future: Clean up any test data created during tests
  // - Remove test users from database
  // - Clear test attestations
  // - Reset any global state

  console.log("✅ Test teardown complete\n");
}

export default globalTeardown;
