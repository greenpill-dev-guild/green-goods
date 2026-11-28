// The production QA suite in ordinary browser tabs of a dedicated QA profile, attached over a
// loopback CDP endpoint on the QA machine. Every test title starts with its catalog Test ID or a
// QA- check name, so a job selects cases with --grep. Read-only cases need no approval; a case
// that writes runs only with Afo's private approval file (GREEN_GOODS_QA_APPROVAL) and passes
// tests/fixtures/production-qa-guard.ts before its first upload, queue admission or signature.
//
//   GREEN_GOODS_QA_CONFIG=~/.config/green-goods-qa/profile.json \
//     bun --no-env-file run playwright test --config tests/production-qa/playwright.config.ts
//
// The installed Green Goods window has its own smoke (tests/installed-pwa). On production a
// browser tab always shows the website, so App cases need the installed window.
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import { loadQaProfile } from "../fixtures/qa-cdp";

const profile = loadQaProfile();
const out = join(profile.evidenceDir, "production-qa");

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  outputDir: join(out, "artifacts"),
  reporter: [["list"], ["json", { outputFile: join(out, "results.json") }]],
  use: {
    trace: "off",
    screenshot: "off",
    video: "off",
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
  },
});
