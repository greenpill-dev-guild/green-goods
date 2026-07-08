import { describe, expect, it } from "vitest";
import {
  APP_ROUTES,
  PUBLIC_PWA_LAUNCH_URL,
  PUBLIC_PWA_ORIGIN,
  PWA_APP_SCOPE,
  PWA_DEV_SERVICE_WORKER_SCRIPT,
  PWA_MANIFEST_ID,
  createPwaLaunchUrl,
  createPwaRoutingConfig,
} from "../../config/pwa-routing";

describe("PWA routing manifest config", () => {
  it("builds launch URLs from the provided origin", () => {
    expect(createPwaLaunchUrl("https://staging.greengoods.app")).toBe(
      "https://staging.greengoods.app/home"
    );
    expect(createPwaLaunchUrl("https://www.greengoods.app")).toBe(
      "https://www.greengoods.app/home"
    );
  });

  it("keeps the production launch URL as the fallback export", () => {
    expect(PUBLIC_PWA_LAUNCH_URL).toBe(`${PUBLIC_PWA_ORIGIN}${APP_ROUTES.home}`);
    expect(PUBLIC_PWA_LAUNCH_URL).toBe("https://www.greengoods.app/home");
  });

  it("serves the dev service worker from the origin root, not relative to nested routes", () => {
    expect(PWA_DEV_SERVICE_WORKER_SCRIPT.startsWith("/")).toBe(true);
    expect(PWA_DEV_SERVICE_WORKER_SCRIPT).toBe("/dev-sw.js?dev-sw");
  });

  it("keeps browser-origin PWA ownership under /home with stable app identity", () => {
    const config = createPwaRoutingConfig(false);

    expect(config.assetBasePath).toBe("/");
    expect(config.manifestId).toBe(PWA_MANIFEST_ID);
    expect(config.manifestScope).toBe(PWA_APP_SCOPE);
    expect(config.serviceWorkerScriptUrl).toBe("/sw.js");
    expect(config.startUrl).toBe(APP_ROUTES.home);
    expect(config.shortcutUrl(APP_ROUTES.garden)).toBe("/home/garden");
    expect(config.shortcutUrl(APP_ROUTES.profile)).toBe("/home/profile");
  });

  it("keeps IPFS builds relative while mapping app routes through the hash router", () => {
    const config = createPwaRoutingConfig(true);

    expect(config.assetBasePath).toBe("./");
    expect(config.manifestId).toBe(PWA_MANIFEST_ID);
    expect(config.manifestScope).toBe("./");
    expect(config.serviceWorkerScriptUrl).toBe("./sw.js");
    expect(config.startUrl).toBe("./#/home");
    expect(config.shortcutUrl(APP_ROUTES.garden)).toBe("./#/home/garden");
    expect(config.shortcutUrl(APP_ROUTES.profile)).toBe("./#/home/profile");
  });
});
