/**
 * Guard: the Hub installs as its own app (PRD-1533). Without a manifest, Chrome installed
 * it with browser controls, labelled it with the page title, and drew its favicon inside
 * Android's own shape. The manifest gives it its own window, the short home-screen label
 * "GG Hub", a maskable icon and a linen splash; every icon it names has to ship.
 *
 * Its icon is the Hub's own: the production ground (white, the green mark) with a HUB band,
 * so an installed Hub never looks like the App beside it, in any environment.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const admin = resolve(__dirname, "../../..");
const manifest = JSON.parse(readFileSync(resolve(admin, "public/manifest.webmanifest"), "utf8"));

describe("Hub web app manifest", () => {
  it("is linked from the page, with the iOS label and icon", () => {
    const html = readFileSync(resolve(admin, "index.html"), "utf8");
    expect(html).toContain('<link rel="manifest" href="%BASE_URL%manifest.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="%BASE_URL%apple-touch-icon.png" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="GG Hub" />');
    expect(existsSync(resolve(admin, "public/apple-touch-icon.png"))).toBe(true);
  });

  it("opens in its own window under the Hub's name and short label", () => {
    expect(manifest).toMatchObject({
      name: "Green Goods Hub",
      short_name: "GG Hub",
      display: "standalone",
      start_url: "./",
      scope: "./",
      background_color: "#FAF8F5",
    });
    // The id is what a phone keys an installed app on: changing it later orphans installs.
    expect(manifest.id).toBe("./");
  });

  it("ships every icon it names at the size it declares, a maskable one included", () => {
    const icons = manifest.icons as Array<{ src: string; sizes: string; purpose: string }>;
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of icons) {
      const png = readFileSync(resolve(admin, "public", icon.src));
      // A PNG's header holds its width and height at bytes 16 and 20.
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
    }
    const apple = readFileSync(resolve(admin, "public/apple-touch-icon.png"));
    expect([apple.readUInt32BE(16), apple.readUInt32BE(20)]).toEqual([180, 180]);
  });

  it("draws the Hub's own icon, never one of the App's", () => {
    const appIcons = readdirSync(resolve(admin, "../client/public"))
      .filter((name) => name.endsWith(".png"))
      .map((name) => readFileSync(resolve(admin, "../client/public", name)));
    const hubIcons = [
      ...new Set([
        ...(manifest.icons as Array<{ src: string }>).map((icon) => icon.src),
        "apple-touch-icon.png",
      ]),
    ];
    for (const src of hubIcons) {
      const icon = readFileSync(resolve(admin, "public", src));
      expect(appIcons.some((appIcon) => appIcon.equals(icon))).toBe(false);
    }
  });

  it("shows wallets the Hub's square icon, not the App's wide logo they crop", () => {
    const root = readFileSync(resolve(admin, "src/components/Boot/AdminRoot.tsx"), "utf8");
    expect(root).toContain("hub-icon-512.png");
    expect(root).not.toContain("greengoods.app/icon.png");
    expect(existsSync(resolve(admin, "public/hub-icon-512.png"))).toBe(true);
  });
});
