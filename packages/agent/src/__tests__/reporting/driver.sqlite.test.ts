import { describe, expect, it } from "vitest";
import { startDriver } from "./driver/server";
import { runWalkthrough } from "./driver/walkthrough";

/**
 * Keeps the loopback development driver honest: the scripted walkthrough runs over real HTTP
 * against the production runtime composition with fixture chain, wallets and transport.
 */
describe("loopback reporting driver", () => {
  it("walks a report from story to publication and steward review", async () => {
    const driver = await startDriver({ port: 0 });
    try {
      const transcript = await runWalkthrough(driver.url, () => {});
      const texts = transcript.map((message) => message.text);
      expect(texts.some((text) => text.startsWith("Photo added to your report."))).toBe(true);
      expect(texts.some((text) => text.includes("• Seedlings planted: 14 seedlings"))).toBe(true);
      expect(texts.some((text) => text.startsWith("Your report is published ✅"))).toBe(true);
      expect(texts.at(-1)).toMatch(/^Your review is recorded ✅/);
      expect([...driver.chain.works.values()][0]?.approved).toBe(true);
    } finally {
      await driver.stop();
    }
  });
});
