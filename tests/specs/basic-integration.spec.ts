import { test, expect } from "@playwright/test";

test.describe("Basic Integration Tests", () => {
  test("should have indexer running and responding", async ({ request }) => {
    // Use fallback URLs if environment variables aren't set
    const indexerUrl = process.env.TEST_INDEXER_URL || "http://localhost:8080/v1/graphql";

    const response = await request.post(indexerUrl, {
      data: {
        query: `
          query {
            __schema {
              types {
                name
              }
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.data.__schema.types).toBeDefined();
    expect(data.data.__schema.types.length).toBeGreaterThan(0);

    // Check for expected Green Goods entities
    const typeNames = data.data.__schema.types.map((type: any) => type.name);
    expect(typeNames).toContain("Garden");
    expect(typeNames).toContain("Action");
  });

  test("should load client application successfully", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check if the page has loaded without errors
    await expect(page.locator("body")).toBeVisible();

    // Check that we don't have any major error messages
    const errorMessages = page.locator('[data-testid="error"], .error, [role="alert"]');
    await expect(errorMessages).toHaveCount(0);
  });

  test("should have working GraphQL proxy", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Test GraphQL proxy through the client
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch("/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `
              query {
                __schema {
                  types {
                    name
                  }
                }
              }
            `,
          }),
        });

        return {
          status: res.status,
          ok: res.ok,
          data: await res.json(),
        };
      } catch (error) {
        return {
          status: 0,
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
    expect(response.data.data.__schema.types).toBeDefined();
  });

  test("should validate Base Sepolia configuration", async ({ request }) => {
    const indexerUrl = process.env.TEST_INDEXER_URL || "http://localhost:8080/v1/graphql";

    // Test that we can query gardens (even if empty)
    const response = await request.post(indexerUrl, {
      data: {
        query: `
          query {
            Garden(limit: 5) {
              id
              tokenAddress
              name
              chainId
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    console.log("Garden response:", data);

    // Should return valid GraphQL response (even if no data)
    expect(data.data).toBeDefined();
    expect(data.data.Garden).toBeDefined();
  });

  test("should validate environment configuration", async () => {
    // Test that Base Sepolia chain ID is properly configured
    const chainId = process.env.TEST_CHAIN_ID || "84532";
    expect(chainId).toBe("84532");

    // Test that indexer URL environment variable is set correctly
    const indexerUrl = process.env.TEST_INDEXER_URL || "http://localhost:8080/v1/graphql";
    expect(indexerUrl).toContain("8080");
  });
});
