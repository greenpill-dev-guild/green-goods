import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createPwaManifestBranding, resolvePwaManifestFlavor } from "../../config/pwaManifest";
import { PWA_MANIFEST_ID } from "../../config/pwaRouting";

const STYLES = resolve(process.cwd(), "../shared/src/styles");
const THEME_SOURCE = readFileSync(resolve(STYLES, "theme.css"), "utf8");
// theme.css reads the DesignMD tokens from the generated stylesheet it imports.
const TOKEN_SOURCES = [
  THEME_SOURCE,
  readFileSync(resolve(STYLES, "design-md.generated.css"), "utf8"),
];

/** Hex for a custom property that holds an `R G B` triple directly or through var(). */
function resolveRgbHex(varName: string): string {
  for (const source of TOKEN_SOURCES) {
    const value = source.match(new RegExp(`${varName}:\\s*([^;]+);`))?.[1];
    const reference = value?.match(/^var\((--[\w-]+)/)?.[1];
    if (reference) return resolveRgbHex(reference);
    const triple = value?.match(/^(\d+) (\d+) (\d+)/);
    if (triple) {
      return `#${triple
        .slice(1, 4)
        .map((channel) => Number(channel).toString(16).padStart(2, "0"))
        .join("")}`;
    }
  }
  throw new Error(`Missing ${varName} triple in the shared styles`);
}

/** The installed app's canvas per theme, read from the app scope blocks in theme.css. */
function appCanvasHex(theme: "light" | "dark"): string {
  const scope =
    theme === "dark"
      ? /\[data-surface="app"\] \[data-theme="dark"\] \{([^}]*)\}/
      : /\n\[data-surface="app"\] \{([^}]*)\}/;
  const value = THEME_SOURCE.match(scope)?.[1]?.match(/--bg-canvas:\s*var\((--[\w-]+)/)?.[1];
  if (!value) throw new Error(`Missing the app's ${theme} --bg-canvas in theme.css`);
  return resolveRgbHex(value);
}

describe("PWA manifest branding", () => {
  it("keeps production on the existing Green Goods install identity", () => {
    const branding = createPwaManifestBranding("production");

    expect(branding.manifestId).toBe(PWA_MANIFEST_ID);
    expect(branding.name).toBe("Green Goods");
    expect(branding.shortName).toBe("Green Goods");
    expect(branding.browserIcon).toBe("icon-192.png");
    expect(branding.manifestIcons.map((icon) => icon.src)).toEqual([
      "images/android-icon-72x72.png",
      "images/android-icon-144x144.png",
      "icon-192.png",
      "icon-512.png",
      "maskable-icon-512.png",
    ]);
  });

  it("tints the browser chrome with the ground each presentation paints", () => {
    const branding = createPwaManifestBranding("production");

    // The website's status bar stays on its white canvas in either theme.
    expect(branding.htmlThemeColorLight).toBe("#ffffff");
    expect(branding.htmlThemeColorDark).toBe("#0c0a09");
    // The installed app's status bar and its manifest take the canvas theme.css
    // paints for the app: linen in light, the warm dark floor in dark.
    expect(branding.appThemeColorLight.toLowerCase()).toBe(appCanvasHex("light"));
    expect(branding.appThemeColorDark.toLowerCase()).toBe(appCanvasHex("dark"));
    expect(branding.themeColor).toBe(branding.appThemeColorLight);
    expect(branding.backgroundColor).toBe(branding.appThemeColorLight);
  });

  it("presents the staging build as the beta app", () => {
    const branding = createPwaManifestBranding("staging");

    // Unchanged on purpose: this is the installed-app identity. If it ever
    // moves, every phone with the app gets a second icon instead of a rename.
    expect(branding.manifestId).toBe("/?gg_pwa=staging");
    // Full name labels the beta; the home-screen label stays plain and lets
    // color do the work where the text is truncated anyway.
    expect(branding.name).toBe("Green Goods Beta");
    expect(branding.shortName).toBe("Green Goods");
    expect(branding.description).toBe("Green Goods Beta: Try and test new features before release");
    expect(branding.themeColor).not.toBe(createPwaManifestBranding("production").themeColor);
    expect(branding.themeColor).toBe("#111b13");
    expect(branding.backgroundColor).toBe("#111b13");
    // One color for both schemes and presentations, so beta stays pinned under
    // either selection.
    expect(branding.htmlThemeColorLight).toBe("#111b13");
    expect(branding.htmlThemeColorDark).toBe("#111b13");
    expect(branding.appThemeColorLight).toBe("#111b13");
    expect(branding.appThemeColorDark).toBe("#111b13");
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
