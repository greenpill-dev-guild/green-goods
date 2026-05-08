import { describe, expect, it } from "vitest";
import {
  createServiceWorkerRegistrationConfig,
  isLegacyServiceWorkerRegistration,
} from "../../../modules/app/service-worker-registration";

describe("service worker registration config", () => {
  it("builds a scoped registration for the /home app namespace", () => {
    const config = createServiceWorkerRegistrationConfig("release-123456", {
      scriptUrl: "/sw.js",
      scope: "/home",
      legacyScopes: ["/"],
    });

    expect(config.scriptUrl).toBe("/sw.js?gg_v=release-123456");
    expect(config.options).toEqual({ scope: "/home", updateViaCache: "none" });
    expect(config.legacyScopes).toEqual(["/"]);
  });

  it("supports relative service worker scripts for hash-router builds", () => {
    const config = createServiceWorkerRegistrationConfig("release-123456", {
      scriptUrl: "./sw.js",
      scope: "./",
    });

    expect(config.scriptUrl).toBe("./sw.js?gg_v=release-123456");
    expect(config.options).toEqual({ scope: "./", updateViaCache: "none" });
  });

  it("detects root-scoped legacy registrations but keeps the current app scope", () => {
    expect(isLegacyServiceWorkerRegistration("https://www.greengoods.app/", "/home", ["/"])).toBe(
      true
    );
    expect(
      isLegacyServiceWorkerRegistration("https://www.greengoods.app/home", "/home", ["/"])
    ).toBe(false);
  });
});
