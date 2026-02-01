---
name: e2e-testing-patterns
description: End-to-end testing patterns with Playwright. Use when implementing E2E tests, debugging flaky tests, or testing critical user flows.
---

# E2E Testing Patterns

Build reliable, fast, and maintainable end-to-end test suites with Playwright.

## When to Use

- Testing critical user journeys
- Debugging flaky tests
- Setting up CI/CD test pipelines
- Cross-browser testing
- Validating accessibility

## Testing Pyramid

```
        ┌─────────┐
        │  E2E    │  ← Few, critical paths only
        ├─────────┤
        │ Integra-│  ← More, component interactions
        │  tion   │
        ├─────────┤
        │  Unit   │  ← Many, fast, isolated
        └─────────┘
```

### What to Test with E2E

✅ Critical user journeys (login, work submission, approval)
✅ Complex interactions (drag-and-drop, multi-step forms)
✅ Cross-browser compatibility
✅ Real API integration
✅ Authentication flows

### What NOT to Test with E2E

❌ Unit-level logic (use Vitest)
❌ API contracts (use integration tests)
❌ Edge cases (too slow)
❌ Implementation details

## Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,  // 2 workers for CI, all available locally
  reporter: [["html"], ["junit", { outputFile: "results.xml" }]],

  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile", use: { ...devices["iPhone 14"] } },
  ],

  webServer: {
    command: "bun run dev:client",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
  },
});
```

## Page Object Model

```typescript
// e2e/pages/LoginPage.ts
import { Locator, Page } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password");
    this.submitButton = page.getByRole("button", { name: "Sign in" });
    this.errorMessage = page.getByRole("alert");
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async getErrorMessage(): Promise<string> {
    return this.errorMessage.textContent() ?? "";
  }
}
```

## Test Fixtures

```typescript
// e2e/fixtures.ts
import { test as base } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  testUser: { email: string; password: string };
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  testUser: async ({}, use) => {
    const user = {
      email: `test-${Date.now()}@example.com`,
      password: "test-password-123",
    };
    // Setup: create user
    await createTestUser(user);
    await use(user);
    // Teardown: cleanup
    await deleteTestUser(user.email);
  },
});

export { expect } from "@playwright/test";
```

## Waiting Strategies

```typescript
// ❌ Bad: Fixed timeout
await page.waitForTimeout(3000);

// ✅ Good: Wait for specific condition
await page.waitForLoadState("networkidle");
await page.waitForURL("/dashboard");
await expect(page.getByText("Welcome")).toBeVisible();

// ✅ Good: Wait for response
await page.waitForResponse((response) =>
  response.url().includes("/api/gardens") && response.status() === 200
);
```

## Network Mocking

```typescript
// Mock API response
await page.route("**/api/gardens", (route) => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([
      { address: "0x123...", name: "Test Garden" }
    ]),
  });
});

// Test error states
await page.route("**/api/work", (route) => {
  route.fulfill({
    status: 500,
    body: JSON.stringify({ error: "Internal Server Error" }),
  });
});
```

## Green Goods E2E Tests

### Critical Flows to Test

```typescript
// e2e/work-submission.spec.ts
import { test, expect } from "./fixtures";

test.describe("Work Submission Flow", () => {
  test("gardener can submit work with photos", async ({ page }) => {
    // Login as gardener
    await page.goto("/login");
    await page.getByRole("button", { name: "Connect Wallet" }).click();

    // Navigate to garden
    await page.goto("/gardens/0x123...");
    await page.getByRole("button", { name: "Log Work" }).click();

    // Fill work form
    await page.getByLabel("Action").selectOption("Planting");
    await page.setInputFiles('[data-testid="photo-upload"]', "test-photo.jpg");
    await page.getByLabel("Feedback").fill("Planted 10 trees");

    // Submit
    await page.getByRole("button", { name: "Submit Work" }).click();

    // Verify success
    await expect(page.getByText("Work submitted successfully")).toBeVisible();
  });

  test("offline work queues for later sync", async ({ page, context }) => {
    // Go offline
    await context.setOffline(true);

    // Submit work
    await page.getByRole("button", { name: "Submit Work" }).click();

    // Verify queued
    await expect(page.getByText("Queued for sync")).toBeVisible();

    // Go online
    await context.setOffline(false);

    // Verify synced
    await expect(page.getByText("Work submitted")).toBeVisible();
  });
});
```

### Accessibility Testing

```typescript
import AxeBuilder from "@axe-core/playwright";

test("dashboard is accessible", async ({ page }) => {
  await page.goto("/dashboard");

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});
```

## Selector Best Practices

```typescript
// ❌ Avoid: Brittle selectors
page.locator(".btn.btn-primary.submit-button").click();
page.locator("div > form > div:nth-child(2) > input").fill("text");

// ✅ Use: Role-based selectors
page.getByRole("button", { name: "Submit" }).click();
page.getByLabel("Email address").fill("user@example.com");

// ✅ Use: Test IDs when needed
page.getByTestId("photo-upload").setInputFiles(file);
```

## Debugging

```bash
# Run in headed mode
npx playwright test --headed

# Debug mode (step through)
npx playwright test --debug

# UI mode (interactive)
npx playwright test --ui

# Generate report
npx playwright show-report
```

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Flaky tests | Use proper waits, not timeouts |
| Slow tests | Mock external APIs, parallelize |
| Coupled tests | Each test independent, clean state |
| Brittle selectors | Use roles, labels, test IDs |
| Missing cleanup | Fixtures handle setup/teardown |
