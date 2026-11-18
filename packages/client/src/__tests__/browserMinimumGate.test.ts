/**
 * @vitest-environment happy-dom
 *
 * The browser minimum gate (scripts/lib/browser-minimum-gate.js) runs on the browsers it turns
 * away, before the app's bundle. These tests hold it to ES5, then run it against a stand-in
 * browser with the minimum's features present or missing.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAst } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { browserMinimumGateScript } from "../../../../scripts/lib/browser-support.mjs";

const GATE_SOURCE = readFileSync(
  resolve(process.cwd(), "../../scripts/lib/browser-minimum-gate.js"),
  "utf8"
);
const browserMinimumGate = new Function(`${GATE_SOURCE}\nreturn browserMinimumGate;`)() as (
  window: unknown,
  options: unknown
) => void;

const ALL_FEATURES = [
  "color-mix",
  "media-query-ranges",
  "registered-properties",
  "well-formed-strings",
];
const TELEMETRY = { host: "https://us.i.posthog.com", key: "phc_test" };

type Feature = (typeof ALL_FEATURES)[number];

interface StandIn {
  missing?: Feature[];
  hostname?: string;
  storedLanguage?: string;
  browserLanguages?: string[];
  presentation?: "pwa" | "website";
  hero?: "focused" | "banner";
}

function standInBrowser({
  missing = [],
  hostname = "greengoods.app",
  storedLanguage,
  browserLanguages = ["en-US"],
  presentation,
  hero,
}: StandIn) {
  const stored = new Map<string, string>(storedLanguage ? [["gg-language", storedLanguage]] : []);
  const beacons: { url: string; body: Blob }[] = [];
  const root = document.documentElement;
  if (presentation) root.setAttribute("data-boot-presentation", presentation);
  if (hero) root.setAttribute("data-boot-hero", hero);
  const has = (feature: Feature) => !missing.includes(feature);

  const window = {
    document,
    CSS: {
      supports: (property: string, value: string) =>
        property === "color" && value.startsWith("color-mix(") && has("color-mix"),
      ...(has("registered-properties") ? { registerProperty: () => undefined } : {}),
    },
    matchMedia: (query: string) => ({
      matches: query === "(width >= 0px)" && has("media-query-ranges"),
    }),
    String: { prototype: has("well-formed-strings") ? { isWellFormed: () => true } : {} },
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    },
    navigator: {
      languages: browserLanguages,
      language: browserLanguages[0],
      sendBeacon: (url: string, body: Blob) => {
        beacons.push({ url, body });
        return true;
      },
    },
    location: { hostname, host: hostname },
    btoa: (text: string) => Buffer.from(text, "binary").toString("base64"),
    Blob,
  };
  return { window, beacons, stored };
}

async function decodeBeacon(body: Blob) {
  const data = new URLSearchParams(await body.text()).get("data") ?? "";
  return JSON.parse(Buffer.from(data, "base64").toString("utf8"));
}

afterEach(() => {
  document.body.innerHTML = "";
  for (const name of ["data-browser-update", "data-boot-presentation", "data-boot-hero"]) {
    document.documentElement.removeAttribute(name);
  }
  document.getElementById("browser-update-styles")?.remove();
});

describe("browser minimum gate", () => {
  it("parses as ES5, so a browser below the minimum can run it", () => {
    const script = browserMinimumGateScript({
      surface: "hub",
      logo: "/logo.png",
      posthogKey: "phc_x",
    });
    const newer = new Set([
      "ArrowFunctionExpression",
      "ClassDeclaration",
      "ClassExpression",
      "TemplateLiteral",
      "SpreadElement",
      "RestElement",
      "ForOfStatement",
      "ObjectPattern",
      "ArrayPattern",
      "AssignmentPattern",
      "ChainExpression",
      "AwaitExpression",
      "YieldExpression",
    ]);
    const found: string[] = [];
    const visit = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(visit);
      const { type, kind, shorthand, method, computed } = node as Record<string, unknown>;
      if (typeof type === "string" && newer.has(type)) found.push(type);
      if (type === "VariableDeclaration" && kind !== "var") found.push(`${kind} declaration`);
      if (type === "Property" && (shorthand || method || computed)) found.push("ES2015 property");
      if (type === "LogicalExpression" && (node as { operator: string }).operator === "??") {
        found.push("??");
      }
      for (const value of Object.values(node)) visit(value);
    };
    visit(parseAst(script));
    expect(found).toEqual([]);
  });

  it("lets a browser at the minimum through untouched", () => {
    const { window, beacons } = standInBrowser({ presentation: "pwa" });
    browserMinimumGate(window, { surface: "client", logo: "/icon.png", telemetry: TELEMETRY });

    expect(document.documentElement.hasAttribute("data-browser-update")).toBe(false);
    expect(document.getElementById("browser-update")).toBeNull();
    expect(beacons).toEqual([]);
  });

  it("puts up the update screen in the App, in the reader's language, and counts it once", async () => {
    const { window, beacons, stored } = standInBrowser({
      missing: ["color-mix", "well-formed-strings"],
      presentation: "pwa",
      storedLanguage: "es",
      browserLanguages: ["pt-BR"],
    });
    browserMinimumGate(window, { surface: "client", logo: "/icon.png", telemetry: TELEMETRY });

    const screen = document.getElementById("browser-update");
    expect(document.documentElement.getAttribute("data-browser-update")).toBe("required");
    expect(screen?.getAttribute("lang")).toBe("es");
    expect(screen?.getAttribute("data-surface")).toBe("app");
    expect(screen?.querySelector("h1")?.textContent).toBe(
      "Actualiza tu navegador para usar Green\u00a0Goods"
    );
    expect(screen?.querySelectorAll("li")).toHaveLength(3);
    expect(screen?.querySelector("img")?.getAttribute("src")).toBe("/icon.png");

    expect(beacons).toHaveLength(1);
    expect(beacons[0].url).toBe("https://us.i.posthog.com/e/?compression=base64");
    const event = await decodeBeacon(beacons[0].body);
    expect(event.event).toBe("browser_update_screen_shown");
    expect(event.properties).toMatchObject({
      token: "phc_test",
      $process_person_profile: false,
      $geoip_disable: true,
      $host: "greengoods.app",
      surface: "app",
      missing_features: ["color-mix", "well-formed-strings"],
      language: "es",
    });
    // Nothing that could name a person or a page travels with it.
    expect(Object.keys(event.properties)).not.toContain("$current_url");
    expect(stored.has("gg-browser-update-reported")).toBe(true);

    document.body.innerHTML = "";
    browserMinimumGate(window, { surface: "client", logo: "/icon.png", telemetry: TELEMETRY });
    expect(document.getElementById("browser-update")).not.toBeNull();
    expect(beacons).toHaveLength(1);
  });

  it("keeps the website open and gates the reporting pages", () => {
    const website = standInBrowser({
      missing: ALL_FEATURES,
      presentation: "website",
      hero: "banner",
    });
    browserMinimumGate(website.window, {
      surface: "client",
      logo: "/icon.png",
      telemetry: TELEMETRY,
    });
    expect(document.getElementById("browser-update")).toBeNull();
    expect(website.beacons).toEqual([]);

    document.documentElement.setAttribute("data-boot-hero", "focused");
    browserMinimumGate(website.window, {
      surface: "client",
      logo: "/icon.png",
      telemetry: TELEMETRY,
    });
    expect(document.getElementById("browser-update")?.getAttribute("data-surface")).toBe("signing");
  });

  it("gates every Hub page, and sends nothing from a development host or without a key", () => {
    const local = standInBrowser({ missing: ["registered-properties"], hostname: "localhost" });
    browserMinimumGate(local.window, { surface: "hub", logo: "/logo.png", telemetry: TELEMETRY });
    expect(document.getElementById("browser-update")?.getAttribute("data-surface")).toBe("hub");
    expect(document.getElementById("browser-update")?.getAttribute("lang")).toBe("en");
    expect(local.beacons).toEqual([]);

    const keyless = standInBrowser({ missing: ["media-query-ranges"] });
    browserMinimumGate(keyless.window, { surface: "hub", logo: "/logo.png", telemetry: null });
    expect(keyless.beacons).toEqual([]);
  });

  it("passes the surface's options without letting a value close the script", () => {
    const script = browserMinimumGateScript({
      surface: "client",
      logo: "/icon.png",
      posthogKey: "phc_</script>",
    });
    expect(script).toContain('"surface":"client"');
    expect(script).not.toContain("</script>");
  });
});
