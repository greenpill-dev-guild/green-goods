import { describe, expect, it } from "vitest";
import { createPwaManifestBranding, resolvePwaManifestFlavor } from "../../config/pwa-manifest";
import { PWA_MANIFEST_ID } from "../../config/pwa-routing";

describe("PWA manifest branding", () => {
  it("keeps production on the existing Green Goods install identity", () => {
    const branding = createPwaManifestBranding("production");

    expect(branding.manifestId).toBe(PWA_MANIFEST_ID);
    expect(branding.name).toBe("Green Goods");
    expect(branding.shortName).toBe("Green Goods");
    expect(branding.themeColor).toBe("#fff");
    expect(branding.backgroundColor).toBe("#fff");
    expect(branding.browserIcon).toBe("icon-192.png");
    expect(branding.manifestIcons.map((icon) => icon.src)).toEqual([
      "images/android-icon-72x72.png",
      "images/android-icon-144x144.png",
      "icon-192.png",
      "icon-512.png",
      "maskable-icon-512.png",
    ]);
  });

  it("brands staging as a distinct QA-installable app", () => {
    const branding = createPwaManifestBranding("staging");

    expect(branding.manifestId).toBe("/?gg_pwa=staging");
    expect(branding.name).toBe("Green Goods Staging");
    expect(branding.shortName).toBe("GG Staging");
    expect(branding.description).toBe("Staging PWA for Green Goods QA.");
    expect(branding.themeColor).toBe("#111b13");
    expect(branding.backgroundColor).toBe("#111b13");
    expect(branding.browserIcon).toBe("staging-icon-192.png");
    expect(branding.shortcutIcon).toBe("staging-icon-192.png");
    expect(branding.manifestIcons.map((icon) => icon.src)).toEqual([
      "images/staging-android-icon-72x72.png",
      "images/staging-android-icon-144x144.png",
      "staging-icon-192.png",
      "staging-icon-512.png",
      "staging-maskable-icon-512.png",
    ]);
    expect(branding.includeAssets).toContain("images/staging-ms-icon-144x144.png");
    expect(branding.appleTouchIcons).toContainEqual({
      sizes: "180x180",
      src: "staging-apple-icon.png",
    });
  });

  it("uses Vercel's custom environment signal for staging builds", () => {
    expect(
      resolvePwaManifestFlavor({
        VERCEL_TARGET_ENV: "staging",
        APP_ENV: "production",
      })
    ).toBe("staging");
  });

  it("lets an explicit manifest flavor override deployment-derived staging", () => {
    expect(
      resolvePwaManifestFlavor({
        PWA_MANIFEST_FLAVOR: "production",
        VERCEL_TARGET_ENV: "staging",
      })
    ).toBe("production");
  });
});
