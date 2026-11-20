/**
 * Guard: the Hub installs as its own app (PRD-1533). Without a manifest, Chrome installed
 * it with browser controls, labelled it with the page title, and drew its favicon inside
 * Android's own shape. The manifest gives it its own window, the short home-screen label
 * "GG Hub", a maskable icon and a linen splash; every icon it names has to ship.
 */
import { existsSync, readFileSync } from "node:fs";
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

  it("ships every icon it names, a maskable one included", () => {
    const icons = manifest.icons as Array<{ src: string; purpose: string }>;
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of icons) {
      expect(existsSync(resolve(admin, "public", icon.src))).toBe(true);
    }
  });
});
