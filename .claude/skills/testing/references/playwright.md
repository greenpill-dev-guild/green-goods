# Playwright E2E Guide

## Testing Pyramid

```
        /-------\
       /  E2E   \    <- Few, critical paths only
      /-----------\
     / Integration \  <- More, component interactions
    /---------------\
   /      Unit       \ <- Many, fast, isolated
  /-------------------\
```

## What to Test with E2E

- Critical user journeys (login, work submission, approval)
- Complex interactions (multi-step forms)
- Cross-browser compatibility
- Authentication flows

## What NOT to Test with E2E

- Unit-level logic (use Vitest)
- API contracts (use integration tests)
- Edge cases (too slow)

## Page Object Model

```typescript
// e2e/pages/LoginPage.ts
import { Locator, Page } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel("Email");
    this.submitButton = page.getByRole("button", { name: "Sign in" });
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.page.getByLabel("Password").fill(password);
    await this.submitButton.click();
  }
}
```

## Waiting Strategies

```typescript
// Bad: Fixed timeout
await page.waitForTimeout(3000);

// Good: Wait for specific condition
await page.waitForLoadState("networkidle");
await page.waitForURL("/dashboard");
await expect(page.getByText("Welcome")).toBeVisible();

// Good: Wait for response
await page.waitForResponse((response) =>
  response.url().includes("/api/gardens") && response.status() === 200
);
```

## Selector Best Practices

```typescript
// Bad: Brittle selectors
page.locator(".btn.btn-primary.submit-button").click();

// Good: Role-based selectors
page.getByRole("button", { name: "Submit" }).click();
page.getByLabel("Email address").fill("user@example.com");

// Good: Test IDs when needed
page.getByTestId("photo-upload").setInputFiles(file);
```

## Network Mocking

```typescript
// Mock API response
await page.route("**/api/gardens", (route) => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ address: "0x123...", name: "Test Garden" }]),
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

## Accessibility Testing

**E2E with Playwright + AxeBuilder:**

```typescript
import AxeBuilder from "@axe-core/playwright";

test("dashboard is accessible", async ({ page }) => {
  await page.goto("/dashboard");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

**Component-level with Storybook a11y addon:**

For component accessibility, use Storybook's built-in a11y addon:

1. Run Storybook: `cd packages/shared && bun run storybook`
2. Open component story
3. Check the "Accessibility" tab for violations

```typescript
// Example story with a11y checks
import type { Meta, StoryObj } from "@storybook/react";
import { GardenCard } from "./GardenCard";

const meta: Meta<typeof GardenCard> = {
  title: "Components/GardenCard",
  component: GardenCard,
  tags: ["autodocs"],
};

export default meta;
```

## Debugging

```bash
npx playwright test --headed     # Run in headed mode
npx playwright test --debug      # Debug mode (step through)
npx playwright test --ui         # UI mode (interactive)
npx playwright show-report       # Generate report
```
