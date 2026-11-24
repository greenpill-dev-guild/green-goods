# E2E Test Guide

## Overview

This guide documents the E2E test improvements made to the Green Goods project to fix failing tests and improve coverage.

## Current coverage

Deterministic CI journeys use `setupAuthenticatedClient` with dev mock auth and
schema-correct backend fixtures. Qualified presets separately cover passkey
rejection/account recovery, seeded read-only work exploration and production PWA
offline reload. See [the runner contract](README.md#projects-and-focused-runs) for
exact qualification and evidence limits.

The legacy-wallet smoke case explicitly selects a disconnected dev mock session;
it does not establish real connector or session restoration behavior. Removed always-skipped work/offline suites supplied no active
proof; the current CI specs exercise those journeys.

## Test Structure

```
tests/
├── specs/                    # Test specifications
│   ├── admin.smoke.spec.ts   # Admin basic functionality
│   ├── admin.auth.spec.ts    # Admin authentication flows
│   ├── client.smoke.spec.ts  # Client basic functionality  
│   ├── client.session-navigation.ci.spec.ts  # Mock-auth sessions and navigation
│   ├── client.offline-work-submission.ci.spec.ts  # Offline upload/recovery
│   ├── client.work-submission.ci.spec.ts  # Required work details validation
│   ├── client.work-approval.ci.spec.ts    # Work approval
│   ├── client.passkey.spec.ts  # Qualified WebAuthn rejection
│   ├── client.reporting-account.passkey.spec.ts  # Qualified account recovery
│   ├── client.pwa-preview.spec.ts  # Production worker/cache proof
│   └── performance.spec.ts   # Performance metrics
├── helpers/
│   ├── test-utils.ts        # Test helpers and utilities
│   └── test-config.ts       # Shared visibility deadlines
├── global-setup.ts          # Global test setup
└── global-teardown.ts       # Global test cleanup
```

## Running Tests

### Local Development
```bash
# Run all E2E tests
bun run browser e2e --preset all

# Run specific test file
bun x playwright test --project=client-ci client.session-navigation.ci.spec.ts

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

Virtual authenticators require Chromium. Run `bun run browser e2e --preset passkey`
for the spec-local CDP ceremonies; use the supported dev mock-auth fixture for CI
content journeys. The disconnected-session smoke runs on every browser, including
iOS; it is not a WebAuthn substitute or real-wallet restoration claim.

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

Use the repository browser wrapper to start the selected app and fixtures. Check
its reported startup failure before rerunning; do not hide unavailable services
behind success returns. `tests/fixtures/playwright-services.ts` owns server needs.

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
