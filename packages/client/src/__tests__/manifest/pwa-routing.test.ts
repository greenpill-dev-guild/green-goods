import { describe, expect, it } from "vitest";
import {
  APP_ROUTES,
  PWA_APP_SCOPE,
  PWA_MANIFEST_ID,
  createPwaRoutingConfig,
} from "../../config/pwa-routing";

describe("PWA routing manifest config", () => {
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
