/**
 * Guard: the Hub installs as its own app (PRD-1533), and each environment installs as its own Hub
 * (PRD-1517). The manifest gives it its own window, a short home-screen label, a maskable icon and
 * a splash; production, beta and alpha each carry their own name, id and icons, so the three Hubs
 * and the App sit apart on one phone. Every icon a manifest names has to ship.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createHubInstallBranding,
  type HubFlavor,
  resolveHubFlavor,
} from "../../../vite/hub-manifest";

const admin = resolve(__dirname, "../../..");
const FLAVORS: HubFlavor[] = ["production", "beta", "alpha"];
const brandings = FLAVORS.map(createHubInstallBranding);
const iconsOf = (flavor: HubFlavor) => {
  const branding = createHubInstallBranding(flavor);
  return [...branding.manifest.icons.map((icon) => icon.src), branding.appleTouchIcon];
};

describe("Hub web app manifest", () => {
  it("is linked from the page, with the environment's iOS label, icon and tab icon", () => {
    const html = readFileSync(resolve(admin, "index.html"), "utf8");
    expect(html).toContain('<link rel="manifest" href="%BASE_URL%manifest.webmanifest" />');
    expect(html).toContain(
      '<link rel="apple-touch-icon" href="%BASE_URL%%HUB_APPLE_TOUCH_ICON%" />'
    );
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="%HUB_SHORT_NAME%" />');
    // The sign-in draws the same icon, found by its marker (ConnectPrompt).
    expect(html).toContain(
      '<link rel="icon" type="image/png" href="%BASE_URL%%HUB_BROWSER_ICON%" data-hub-icon />'
    );
  });

  it("names each environment's Hub, and gives each its own install id", () => {
    expect(
      brandings.map(({ manifest }) => [manifest.name, manifest.short_name, manifest.id])
    ).toEqual([
      // Production keeps the id it shipped with, so installed Hubs update in place.
      ["Green Goods Hub", "GG Hub", "./"],
      ["Green Goods Hub Beta", "Hub Beta", "./?gg_hub=beta"],
      ["Green Goods Hub Alpha", "Hub Alpha", "./?gg_hub=alpha"],
    ]);
    for (const { manifest } of brandings) {
      expect(manifest).toMatchObject({ display: "standalone", start_url: "./", scope: "./" });
    }
  });

  it("opens every environment on the linen splash, where its icon names the environment", () => {
    for (const { manifest } of brandings) {
      expect(manifest).toMatchObject({ background_color: "#FAF8F5", theme_color: "#FAF8F5" });
    }
  });

  it("ships every icon each environment names, a maskable one included", () => {
    for (const { manifest } of brandings) {
      expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    }
    for (const src of FLAVORS.flatMap(iconsOf)) {
      expect(existsSync(resolve(admin, "public", src)), src).toBe(true);
    }
  });

  it("draws icons no other Hub or App install shares", () => {
    const appIcons = [
      "icon-512.png",
      "maskable-icon-512.png",
      "apple-icon.png",
      "staging-icon-512.png",
      "staging-maskable-icon-512.png",
      "staging-apple-icon.png",
      "alpha-icon-512.png",
      "alpha-maskable-icon-512.png",
      "alpha-apple-icon.png",
    ].map((name) => readFileSync(resolve(admin, "../client/public", name)));
    const hubIcons = FLAVORS.flatMap(iconsOf).map((src) =>
      readFileSync(resolve(admin, "public", src))
    );
    for (const [index, icon] of hubIcons.entries()) {
      expect(appIcons.some((appIcon) => appIcon.equals(icon))).toBe(false);
      expect(hubIcons.findIndex((other) => other.equals(icon))).toBe(index);
    }
  });

  it("brands a build by the environment it deploys to, as the App does", () => {
    expect(resolveHubFlavor({})).toBe("production");
    expect(resolveHubFlavor({ VERCEL_TARGET_ENV: "production" })).toBe("production");
    // develop deploys to the `staging` Vercel environment, which serves beta.
    expect(resolveHubFlavor({ VERCEL_TARGET_ENV: "staging" })).toBe("beta");
    // Vercel calls an alpha build a preview; its branch is the signal.
    expect(resolveHubFlavor({ VERCEL_GIT_COMMIT_REF: "alpha", VERCEL_TARGET_ENV: "preview" })).toBe(
      "alpha"
    );
    // A deployment target never claims alpha on its own.
    expect(resolveHubFlavor({ VERCEL_TARGET_ENV: "alpha" })).toBe("production");
    expect(resolveHubFlavor({ VERCEL_GIT_COMMIT_REF: "feature/x" })).toBe("production");
    expect(resolveHubFlavor({ PWA_MANIFEST_FLAVOR: "staging" })).toBe("beta");
  });

  it("shows wallets the Hub's square icon, not the App's wide logo they crop", () => {
    const root = readFileSync(resolve(admin, "src/components/Boot/AdminRoot.tsx"), "utf8");
    expect(root).toContain("hub-icon-512.png");
    expect(root).not.toContain("greengoods.app/icon.png");
    expect(existsSync(resolve(admin, "public/hub-icon-512.png"))).toBe(true);
  });
});
