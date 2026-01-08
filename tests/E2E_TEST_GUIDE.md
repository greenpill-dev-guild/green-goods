# E2E Test Guide

## Overview

This guide documents the E2E test improvements made to the Green Goods project to fix failing tests and improve coverage.

## Key Improvements

### 1. Fixed Authentication Tests
- **Passkey Tests**: Added proper WebAuthn virtual authenticator setup with better wait conditions
- **Wallet Tests**: Improved wallet connection modal detection with multiple selector strategies
- **Error Handling**: Added proper error state detection and retry mechanisms

### 2. Fixed Offline/Sync Tests
- **Flexible Selectors**: Tests now check multiple possible selectors for offline indicators
- **Better Timing**: Increased wait times for network state changes to propagate
- **State Persistence**: Improved tests for offline state persistence across reloads

### 3. Improved Test Stability
- **Centralized Configuration**: Created `test-config.ts` with consistent timeouts and selectors
- **Helper Functions**: Added utilities for waiting on elements, retrying actions, and network idle
- **Better Wait Conditions**: Replaced hard-coded timeouts with proper element visibility checks

### 4. Enhanced Test Coverage
- **Navigation Tests**: Added comprehensive navigation and routing tests
- **Admin Auth Tests**: Created dedicated admin authentication test suite
- **Performance Tests**: Added performance monitoring and resource loading tests

### 5. Optimized Test Execution
- **Parallel Projects**: Separated test runs by app (admin/client) and platform
- **Targeted Test Matching**: Tests only run on appropriate platforms
- **Reduced CI Load**: Disabled video recording in CI, optimized worker count

## Test Structure

```
tests/
├── specs/                    # Test specifications
│   ├── admin.smoke.spec.ts   # Admin basic functionality
│   ├── admin.auth.spec.ts    # Admin authentication flows
│   ├── client.smoke.spec.ts  # Client basic functionality  
│   ├── client.auth.spec.ts   # Client authentication flows
│   ├── client.offline-sync.spec.ts  # Offline functionality
│   ├── client.work-submission.spec.ts  # Work submission
│   ├── client.work-approval.spec.ts    # Work approval
│   ├── client.navigation.spec.ts  # Navigation and routing
│   └── performance.spec.ts   # Performance metrics
├── helpers/
│   ├── test-utils.ts        # Test helpers and utilities
│   └── test-config.ts       # Centralized configuration
├── global-setup.ts          # Global test setup
└── global-teardown.ts       # Global test cleanup
```

## Running Tests

### Local Development
```bash
# Run all E2E tests
bun test:e2e

# Run specific test file
bun exec playwright test client.auth.spec.ts

# Run in headed mode for debugging
bun exec playwright test --headed

# Run with specific project
bun exec playwright test --project=chromium
```

### Debugging Failed Tests
```bash
# Run with debug UI
bun exec playwright test --debug

# Generate and view HTML report
bun exec playwright show-report
```

## Common Issues and Solutions

### 1. Flaky Tests
- **Issue**: Tests pass sometimes but fail others
- **Solution**: Use proper wait conditions instead of hard timeouts
```typescript
// Bad
await page.waitForTimeout(1000);

// Good
await expect(element).toBeVisible({ timeout: TIMEOUTS.elementVisible });
```

### 2. WebAuthn Not Working
- **Issue**: Passkey tests fail on iOS Safari
- **Solution**: Use platform detection and wallet auth fallback
```typescript
if (isIOS(testInfo.project.name)) {
  await helper.injectWalletAuth();
} else {
  await helper.setupPasskeyAuth();
}
```

### 3. Offline Tests Failing
- **Issue**: Offline indicator not found
- **Solution**: Check multiple possible selectors
```typescript
const offlineSelectors = [
  '[data-testid="offline-indicator"]',
  'div:has-text("Offline")',
  '[role="status"]:has-text("Offline")'
];
```

### 4. Service Not Ready
- **Issue**: Tests fail because services aren't fully started
- **Solution**: Add retry logic for service health checks
```typescript
await retryWithBackoff(async () => {
  const response = await request.get("/");
  expect(response.status()).toBeLessThan(500);
}, { maxRetries: 3 });
```

## Best Practices

1. **Use Data Test IDs**: Add `data-testid` attributes to key elements
2. **Avoid Hard Waits**: Use proper wait conditions and element visibility
3. **Platform-Specific Tests**: Skip tests that don't apply to certain platforms
4. **Clean Up Resources**: Always clean up virtual authenticators and test data
5. **Descriptive Test Names**: Make test purpose clear from the name
6. **Group Related Tests**: Use `test.describe` blocks for organization

## Future Improvements

1. **Visual Regression Tests**: Add screenshot comparison tests
2. **API Mocking**: Mock external services for more reliable tests
3. **Test Data Management**: Implement test data factories
4. **Cross-Browser Testing**: Add Firefox and Edge to test matrix
5. **Accessibility Tests**: Add automated a11y checks