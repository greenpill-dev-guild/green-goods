// The installed-app smoke: a read-only check of the Green Goods window installed in a dedicated QA
// browser profile, attached over a loopback CDP endpoint. It owns its settings: no web servers, no
// global setup (the root setup forces localhost), one worker and no retries, so a failure is the
// app's or the profile's, never a retry's. Run it on the QA machine itself:
//
//   GREEN_GOODS_PWA_CDP_ENDPOINT=http://127.0.0.1:<port> \
//     bun --no-env-file run playwright test --config tests/installed-pwa/playwright.config.ts
//
// The runbook is docs/docs/builders/quality/automated-qa.mdx.
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import { loadQaProfile } from "../fixtures/qa-cdp";

const profile = loadQaProfile();
const out = join(profile.evidenceDir, "installed-pwa");

export default defineConfig({
  testDir: ".",
  testMatch: "*.smoke.spec.ts",
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
