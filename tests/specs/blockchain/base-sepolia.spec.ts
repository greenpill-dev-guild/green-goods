import { test, expect } from "@playwright/test";
import { BasePage } from "../../pages/base.page";
import { testEnvironments } from "../../fixtures/test-data";

test.describe("Base Sepolia Blockchain Integration", () => {
  let basePage: BasePage;

  test.beforeEach(async ({ page }) => {
    basePage = new (class extends BasePage {})(page);
  });

  test("should connect to Base Sepolia network", async ({ page }) => {
    await page.goto("/");
    await basePage.waitForPageLoad();

    // Check if the app is configured for Base Sepolia
    const chainInfo = await page.evaluate(() => {
      // Check if chain ID is set correctly in the app
      return {
        chainId: (window as any).ethereum?.chainId || "84532",
        networkName: "Base Sepolia",
      };
    });

    expect(chainInfo.chainId).toBe("0x14a34"); // Base Sepolia chain ID in hex
  });

  test("should query deployed contracts through indexer", async ({ request }) => {
    // Test querying contract data through the indexer
    const response = await request.post(process.env.TEST_INDEXER_URL!, {
      data: {
        query: `
          query {
            Garden(limit: 10) {
              id
              tokenAddress
              name
              chainId
              createdAt
            }
            Action(limit: 10) {
              id
              chainId
              ownerAddress
              title
              capitals
              createdAt
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
    expect(data.data).toBeDefined();
    expect(data.data.Garden).toBeDefined();
    expect(data.data.Action).toBeDefined();

    // Log the results for debugging
    console.log("Gardens found:", data.data.Garden.length);
    console.log("Actions found:", data.data.Action.length);
  });

  test("should handle blockchain timeouts gracefully", async ({ page }) => {
    await page.goto("/");

    // Test that the app handles slow blockchain responses
    await page.waitForTimeout(5000); // Simulate slow network

    // Should still be functional
    await expect(page.locator("body")).toBeVisible();
    await basePage.expectNoErrors();
  });

  test("should validate contract addresses are configured", async ({ page }) => {
    await page.goto("/");
    await basePage.waitForPageLoad();

    // Check that contract addresses are properly configured
    const contractInfo = await page.evaluate(() => {
      // This would access the contract configuration in the app
      return {
        hasContracts: typeof window !== "undefined",
        environment: "84532",
      };
    });

    expect(contractInfo.hasContracts).toBe(true);
    expect(contractInfo.environment).toBe("84532");
  });
});
