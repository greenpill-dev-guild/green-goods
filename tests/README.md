# Green Goods E2E Tests

Playwright tests for client (PWA) and admin (dashboard) with platform-specific authentication.

> **For general setup and contributing:** See [Developer Documentation](../docs/developer/getting-started.md)

## Quick Start

```bash
# Start services
bun dev

# Run smoke tests (fastest)
bun test:e2e:smoke

# Platform-specific
bun test:e2e:android   # Client PWA on Android (passkey)
bun test:e2e:ios       # Client PWA on iOS (wallet)
bun test:e2e:admin     # Admin dashboard (wallet)

# Debug with UI
bun test:e2e:ui
```

## Test Structure

```
tests/
├── specs/
│   ├── client.smoke.spec.ts  # Client PWA (login + gardens)
│   └── admin.smoke.spec.ts   # Admin dashboard (login + gardens)
├── helpers/
│   └── test-utils.ts         # ClientTestHelper, AdminTestHelper
├── global-setup.ts            # Health checks, env vars
├── global-teardown.ts         # Cleanup
└── run-tests.ts               # Test runner CLI
```

## Platform-Specific Authentication

| Platform | Auth Method | Why |
|----------|-------------|-----|
| **Android Chrome** | Passkey (virtual WebAuthn) | Full automation support |
| **iOS Safari** | Wallet (storage injection) | Safari lacks virtual WebAuthn |
| **Admin Desktop** | Wallet (storage injection) | Fast, no real wallet needed |

### Client Tests (Platform Detection)

```typescript
test("can view gardens", async ({ page }, testInfo) => {
  const helper = new ClientTestHelper(page);
  const ios = testInfo.project.name === "mobile-safari";

  if (ios) {
    // iOS - wallet injection
    await helper.injectWalletAuth();
    await page.goto("/home");
  } else {
    // Android/Chromium - passkey
    await helper.setupPasskeyAuth();
    await helper.createPasskeyAccount(`test_${Date.now()}`);
  }

  // Test assertions...
});
```

### Admin Tests (Wallet Only)

```typescript
test("can access dashboard", async ({ page }) => {
  const helper = new AdminTestHelper(page);
  await helper.injectWalletAuth();
  
  await page.goto("/dashboard");
  // Assertions...
});
```

## Writing New Tests

### 1. Choose Test Helper

```typescript
// Client PWA
import { ClientTestHelper } from "../helpers/test-utils";
const helper = new ClientTestHelper(page);

// Admin Dashboard
import { AdminTestHelper } from "../helpers/test-utils";
const helper = new AdminTestHelper(page);
```

### 2. Authenticate

```typescript
// Android/Chromium - Passkey
await helper.setupPasskeyAuth();
await helper.createPasskeyAccount("username");

// iOS/Admin - Wallet
await helper.injectWalletAuth("0xAddress");
await page.goto("/route");
```

### 3. Query Indexer

```typescript
import { hasGardens, queryIndexer } from "../helpers/test-utils";

// Simple check
const gardensExist = await hasGardens(page);

// Custom query
const data = await queryIndexer(page, `
  query { Garden(limit: 5) { id name } }
`);
```

### 4. Handle Data Variance

```typescript
const gardensExist = await hasGardens(page);

if (gardensExist) {
  // Test with real data
  await expect(page.locator('[data-testid="garden-card"]').first()).toBeVisible();
} else {
  // Test empty state
  await expect(page.locator("text=No gardens")).toBeVisible();
}
```

## Test Runner Commands

```bash
# Development
bun tests/run-tests.ts check        # Health check
bun tests/run-tests.ts smoke        # Quick validation
bun tests/run-tests.ts mobile       # Android + iOS
bun tests/run-tests.ts ui           # Visual debugger

# Platform-specific
bun tests/run-tests.ts smoke:client
bun tests/run-tests.ts smoke:admin
bun tests/run-tests.ts mobile:android
bun tests/run-tests.ts mobile:ios

# Full help
bun tests/run-tests.ts help
```

## Debugging

### Playwright UI (Recommended)

```bash
bun test:e2e:ui
```

Features: time-travel debugging, step-through, DOM inspection.

### Headed Mode

```bash
bun tests/run-tests.ts headed
```

Watch browser execute tests in real-time.

### Debug Specific Test

```bash
npx playwright test tests/specs/client.smoke.spec.ts --debug
```

### Trace Viewer

```bash
# After test failure
npx playwright show-report
```

## Configuration

Key settings in `playwright.config.ts`:

```typescript
projects: [
  { name: "chromium" },       // Desktop (admin + dev)
  { name: "mobile-chrome" },  // Android Pixel 5
  { name: "mobile-safari" },  // iPhone 13 Pro
]

webServer: [
  { command: "bun dev:indexer", port: 8080 },
  { command: "bun dev:client", port: 3001 },
  { command: "bun dev:admin", port: 3002 },
]
```

**Environment variables** (set in `global-setup.ts`):
- `TEST_CLIENT_URL` → https://localhost:3001
- `TEST_ADMIN_URL` → https://localhost:3002
- `TEST_INDEXER_URL` → http://localhost:8080/v1/graphql
- `TEST_CHAIN_ID` → 84532 (Base Sepolia)

## CI/CD

Smoke tests run automatically on push:

```yaml
# .github/workflows/e2e-tests.yml
- run: |
    bun dev &
    sleep 30
    bun test:e2e:smoke  # Chromium only in CI
```

Manual QA on real devices:
- iOS Safari (TestFlight or local)
- Android Chrome (local or cloud device)
- PWA install + offline mode

## Architecture Deep Dive

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for:
- Test execution flow diagrams
- Virtual WebAuthn technical details
- Cursor + Playwright + MCP workflow
- When to use which debugging tool

## Reference

- [Playwright Documentation](https://playwright.dev)
- [Green Goods Developer Guide](../docs/developer/getting-started.md)
- [Test Architecture](./ARCHITECTURE.md)
