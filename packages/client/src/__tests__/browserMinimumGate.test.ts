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
import {
  browserMinimumGateScript,
  SUPPORTED_BROWSER_TARGETS,
} from "../../../../scripts/lib/browser-support.mjs";

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
const MINIMUM = SUPPORTED_BROWSER_TARGETS.join(" ");

type Feature = (typeof ALL_FEATURES)[number];

interface StandIn {
  missing?: Feature[];
  online?: boolean;
  hostname?: string;
  storedLanguage?: string;
  browserLanguages?: string[];
  presentation?: "pwa" | "website";
  hero?: "focused" | "banner";
}

/** A request the gate opened; `respond` is PostHog answering it. */
interface SentRequest {
  method: string;
  url: string;
  contentType: string;
  body: string;
  respond: (status: number) => void;
}

function standInBrowser({
  missing = [],
  online = true,
  hostname = "greengoods.app",
  storedLanguage,
  browserLanguages = ["en-US"],
  presentation,
  hero,
}: StandIn) {
  const stored = new Map<string, string>(storedLanguage ? [["gg-language", storedLanguage]] : []);
  const requests: SentRequest[] = [];
  const listeners = new Map<string, () => void>();
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
      onLine: online,
    },
    location: { hostname, host: hostname },
    btoa: (text: string) => Buffer.from(text, "binary").toString("base64"),
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
    XMLHttpRequest: class {
      status = 0;
      onload: (() => void) | null = null;
      private sent: Partial<SentRequest> = {};
      open(method: string, url: string) {
        this.sent = { method, url };
      }
      setRequestHeader(name: string, value: string) {
        if (name === "Content-Type") this.sent.contentType = value;
      }
      send(body: string) {
        requests.push({
          ...(this.sent as SentRequest),
          body,
          respond: (status) => {
            this.status = status;
            this.onload?.();
          },
        });
      }
    },
  };
  /** The browser getting its connection back. */
  const reconnect = () => listeners.get("online")?.();
  return { window, requests, stored, reconnect };
}

function decodeEvent(body: string) {
  const data = new URLSearchParams(body).get("data") ?? "";
  return JSON.parse(Buffer.from(data, "base64").toString("utf8"));
}

afterEach(() => {
  document.body.innerHTML = "";
  for (const name of ["data-browser-update", "data-boot-presentation", "data-boot-hero"]) {
    document.documentElement.removeAttribute(name);
  }
  for (const style of document.querySelectorAll("#browser-update-styles")) style.remove();
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
      const { operator, param, regex } = node as {
        operator?: string;
        param?: unknown;
        regex?: { flags: string };
      };
      if (type === "LogicalExpression" && operator === "??") found.push("??");
      if (type === "BinaryExpression" && operator === "**") found.push("**");
      if (
        type === "AssignmentExpression" &&
        operator &&
        !/^[-+*/%&|^]?=$|^(<<|>>>?)=$/.test(operator)
      ) {
        found.push(`${operator} assignment`);
      }
      if (type === "CatchClause" && param === null) found.push("catch without a binding");
      if (regex && /[^gim]/.test(regex.flags)) found.push(`regex flags ${regex.flags}`);
      for (const value of Object.values(node)) visit(value);
    };
    visit(parseAst(script));
    expect(found).toEqual([]);
  });

  it("lets a browser at the minimum through untouched", () => {
    const { window, requests } = standInBrowser({ presentation: "pwa" });
    browserMinimumGate(window, {
      surface: "client",
      logo: "/icon.png",
      minimum: MINIMUM,
      telemetry: TELEMETRY,
    });

    expect(document.documentElement.hasAttribute("data-browser-update")).toBe(false);
    expect(document.getElementById("browser-update")).toBeNull();
    expect(requests).toEqual([]);
  });

  it("puts up the update screen in the App, in the reader's language, and counts it once", () => {
    const { window, requests, stored } = standInBrowser({
      missing: ["color-mix", "well-formed-strings"],
      presentation: "pwa",
      storedLanguage: "es",
      browserLanguages: ["pt-BR"],
    });
    browserMinimumGate(window, {
      surface: "client",
      logo: "/icon.png",
      minimum: MINIMUM,
      telemetry: TELEMETRY,
    });

    const screen = document.getElementById("browser-update");
    expect(document.documentElement.getAttribute("data-browser-update")).toBe("required");
    expect(screen?.getAttribute("lang")).toBe("es");
    expect(screen?.getAttribute("data-surface")).toBe("app");
    expect(screen?.querySelector("h1")?.textContent).toBe(
      "Actualiza tu navegador para usar Green\u00a0Goods"
    );
    // The App says its saved work is safe before it says what to do.
    const safe = screen?.querySelector(".browser-update-safe");
    expect(safe?.textContent).toBe(
      "Lo que guardaste sigue en este teléfono. Mantén la app instalada y no borres sus datos."
    );
    expect(safe?.nextElementSibling?.className).toBe("browser-update-lede");
    expect(screen?.querySelectorAll("li")).toHaveLength(3);
    expect(screen?.querySelector("img")?.getAttribute("src")).toBe("/icon.png");

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "https://us.i.posthog.com/e/?compression=base64",
      contentType: "application/x-www-form-urlencoded",
    });
    const event = decodeEvent(requests[0].body);
    expect(Object.keys(event)).toEqual(["event", "properties"]);
    expect(event.event).toBe("browser_update_screen_shown");
    // These and nothing else: no URL, path, referrer, device time or stored identifier.
    expect(Object.keys(event.properties).sort()).toEqual(
      [
        "$geoip_disable",
        "$host",
        "$lib",
        "$process_person_profile",
        "distinct_id",
        "language",
        "minimum",
        "missing_features",
        "surface",
        "token",
      ].sort()
    );
    expect(event.properties).toMatchObject({
      token: "phc_test",
      $process_person_profile: false,
      $geoip_disable: true,
      $host: "greengoods.app",
      surface: "app",
      minimum: MINIMUM,
      missing_features: ["color-mix", "well-formed-strings"],
      language: "es",
    });
    expect(stored.has("gg-browser-update-reported")).toBe(false);
    requests[0].respond(200);
    expect(stored.get("gg-browser-update-reported")).toBe(MINIMUM);

    document.body.innerHTML = "";
    browserMinimumGate(window, {
      surface: "client",
      logo: "/icon.png",
      minimum: MINIMUM,
      telemetry: TELEMETRY,
    });
    expect(document.getElementById("browser-update")).not.toBeNull();
    expect(requests).toHaveLength(1);
  });

  it("counts a browser once per minimum, after PostHog has taken the event", () => {
    const { window, requests, stored, reconnect } = standInBrowser({
      missing: ["registered-properties"],
      online: false,
    });
    browserMinimumGate(window, {
      surface: "hub",
      logo: "/logo.png",
      minimum: MINIMUM,
      telemetry: TELEMETRY,
    });
    // Offline, it waits for the connection instead of sending into nothing.
    expect(requests).toHaveLength(0);
    reconnect();
    expect(requests).toHaveLength(1);

    requests[0].respond(503);
    expect(stored.has("gg-browser-update-reported")).toBe(false);
    window.navigator.onLine = true;
    browserMinimumGate(window, {
      surface: "hub",
      logo: "/logo.png",
      minimum: MINIMUM,
      telemetry: TELEMETRY,
    });
    expect(requests).toHaveLength(2);
    requests[1].respond(200);

    // A browser counted under one minimum is counted again once the line moves.
    const raised = "chrome119 edge119 firefox128 safari17 ios17";
    browserMinimumGate(window, {
      surface: "hub",
      logo: "/logo.png",
      minimum: raised,
      telemetry: TELEMETRY,
    });
    expect(requests).toHaveLength(3);
    expect(decodeEvent(requests[2].body).properties.minimum).toBe(raised);
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
      minimum: MINIMUM,
      telemetry: TELEMETRY,
    });
    expect(document.getElementById("browser-update")).toBeNull();
    expect(website.requests).toEqual([]);

    document.documentElement.setAttribute("data-boot-hero", "focused");
    browserMinimumGate(website.window, {
      surface: "client",
      logo: "/icon.png",
      minimum: MINIMUM,
      telemetry: TELEMETRY,
    });
    const signing = document.getElementById("browser-update");
    expect(signing?.getAttribute("data-surface")).toBe("signing");
    // A reporting page was opened from a chat link, and holds nothing on the phone.
    expect(signing?.querySelector(".browser-update-lede")?.textContent).toContain(
      "then open the link again."
    );
    expect(signing?.querySelector(".browser-update-safe")).toBeNull();
  });

  it("gates every Hub page, and sends nothing from a development host or without a key", () => {
    const local = standInBrowser({ missing: ["registered-properties"], hostname: "localhost" });
    browserMinimumGate(local.window, {
      surface: "hub",
      logo: "/logo.png",
      minimum: MINIMUM,
      telemetry: TELEMETRY,
    });
    expect(document.getElementById("browser-update")?.getAttribute("data-surface")).toBe("hub");
    expect(document.getElementById("browser-update")?.getAttribute("lang")).toBe("en");
    expect(document.querySelector(".browser-update-safe")).toBeNull();
    expect(local.requests).toEqual([]);

    // The dev tunnel (scripts/dev/tunnel.js) is a development host too.
    const tunnel = standInBrowser({
      missing: ["registered-properties"],
      hostname: "quiet-river-1234.trycloudflare.com",
    });
    browserMinimumGate(tunnel.window, {
      surface: "hub",
      logo: "/logo.png",
      minimum: MINIMUM,
      telemetry: TELEMETRY,
    });
    expect(tunnel.requests).toEqual([]);

    const keyless = standInBrowser({ missing: ["media-query-ranges"] });
    browserMinimumGate(keyless.window, {
      surface: "hub",
      logo: "/logo.png",
      minimum: MINIMUM,
      telemetry: null,
    });
    expect(keyless.requests).toEqual([]);
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
