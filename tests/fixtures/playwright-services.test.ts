import { describe, expect, it } from "vitest";
import {
  resolvePlaywrightApps,
  selectedProjectNames,
  shouldUsePlaywrightIndexer,
} from "./playwright-services";

describe("Playwright service selection", () => {
  it("parses repeated and inline project flags", () => {
    expect(
      selectedProjectNames([
        "node",
        "playwright",
        "test",
        "--project=client-ci",
        "--project",
        "admin-ci",
      ])
    ).toEqual(["client-ci", "admin-ci"]);
  });

  it("starts only the app required by an exact project selection", () => {
    expect(resolvePlaywrightApps({ argv: ["--project=client-ci"] })).toEqual({
      admin: false,
      client: true,
    });
    expect(resolvePlaywrightApps({ argv: ["--project", "admin-ci"] })).toEqual({
      admin: true,
      client: false,
    });
  });

  it("unions multi-project app requirements", () => {
    expect(resolvePlaywrightApps({ argv: ["--project=client-ci", "--project=admin-ci"] })).toEqual({
      admin: true,
      client: true,
    });
    expect(resolvePlaywrightApps({ argv: ["--project=critical-path"] })).toEqual({
      admin: true,
      client: true,
    });
  });

  it("uses PLAYWRIGHT_APP only without CLI projects and keeps unknown selectors safe", () => {
    expect(resolvePlaywrightApps({ argv: [], playwrightApp: "client" })).toEqual({
      admin: false,
      client: true,
    });
    expect(
      resolvePlaywrightApps({
        argv: ["--project=client-*"],
        playwrightApp: "client",
      })
    ).toEqual({ admin: true, client: true });
  });

  it("keeps the indexer explicit in CI and honors skip overrides", () => {
    expect(shouldUsePlaywrightIndexer({ CI: "true" })).toBe(false);
    expect(shouldUsePlaywrightIndexer({ CI: "true", REQUIRE_INDEXER: "true" })).toBe(true);
    expect(
      shouldUsePlaywrightIndexer({
        CI: "true",
        REQUIRE_INDEXER: "true",
        SKIP_INDEXER: "true",
      })
    ).toBe(false);
    expect(shouldUsePlaywrightIndexer({})).toBe(true);
  });
});
