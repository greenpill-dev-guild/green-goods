import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The oldest browsers the installed app, the public website and the steward
 * dashboard support: Chrome and Edge 111, Firefox 128, and Safari 16.4 on macOS
 * and iOS. Tailwind CSS v4 builds its CSS for the same line.
 *
 * The client and admin Vite configs pass this list as `build.target`; the CSS
 * target follows it, and so does the client's service worker build. Naming it
 * here keeps a toolchain upgrade from moving the line without a change in review.
 * The runtime checks in browser-minimum-gate.js draw the same line in the browser.
 */
export const SUPPORTED_BROWSER_TARGETS = Object.freeze([
  "chrome111",
  "edge111",
  "firefox128",
  "safari16.4",
  "ios16.4",
]);

/** The PostHog host the apps' own analytics send to (shared posthog-browser.ts). */
const POSTHOG_HOST = "https://us.i.posthog.com";

const GATE_SOURCE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "browser-minimum-gate.js");

/**
 * The inline script that shows the update screen below the minimum: the gate file in a scope of
 * its own, called with this page's options. Full-line comments are left out of the page.
 */
export function browserMinimumGateScript({ surface, logo, posthogKey }) {
  const source = readFileSync(GATE_SOURCE_PATH, "utf8")
    .replace(/^\s*\/\*\*[\s\S]*?\*\/\n/gm, "")
    .replace(/^\s*\/\/.*\n/gm, "");
  // Escaped so no value can close the script element.
  const options = JSON.stringify({
    surface,
    logo,
    minimum: SUPPORTED_BROWSER_TARGETS.join(" "),
    telemetry: posthogKey ? { host: POSTHOG_HOST, key: posthogKey } : null,
  }).replace(/</g, "\\u003c");
  return `(function () {\n${source}\nbrowserMinimumGate(window, ${options});\n})();`;
}

/**
 * Puts the gate first in <body>, ahead of the app's deferred module bundle, in development and
 * in builds. `surface` is "hub" (every Hub page) or "client" (the installed App and the reporting
 * pages; the website stays open). `posthogKey` is the surface's own PostHog project key.
 */
export function browserMinimumGatePlugin(options) {
  return {
    name: "green-goods-browser-minimum-gate",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { id: "browser-minimum-gate" },
          children: browserMinimumGateScript(options),
          injectTo: "body-prepend",
        },
      ];
    },
  };
}
