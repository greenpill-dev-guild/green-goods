import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * The QA app ships as a plain static page — no bundler, no typecheck, no test
 * runner of its own. That is the right trade for a three-person internal tool,
 * but it means a syntax error in `index.html` reaches the deployment intact and
 * the first sign of it is a blank checklist at the start of a QA session.
 *
 * These are the cheap guards that would have caught that, plus the two places
 * the page and the server can silently drift apart.
 */

const repoRoot = path.join(import.meta.dirname, "..", "..");
const appDir = path.join(repoRoot, "packages", "qa");
const page = readFileSync(path.join(appDir, "index.html"), "utf8");

function inlineScript(): string {
  // Literal slicing rather than a tag-shaped regex. This is not sanitizing
  // hostile HTML — it reads one file we author — but a regex that pattern-
  // matches an HTML tag reads as a broken sanitizer to scanners, and the
  // string search is both clearer and exactly as correct here.
  const OPEN = "<script>";
  const start = page.indexOf(OPEN);
  const end = page.lastIndexOf("</script>");
  if (start < 0 || end < start) throw new Error("index.html has no inline <script>");
  return page.slice(start + OPEN.length, end);
}

describe("QA app page", () => {
  it("has an inline script that actually parses", () => {
    // `new Script` compiles without running: a missing brace or a stray `*/`
    // fails here instead of at the top of Tuesday's session.
    expect(() => new Script(inlineScript())).not.toThrow();
  });

  it("gives every selectable control a selected state and every note a name", () => {
    const script = inlineScript();
    // Selection lived only in the `on` class, which a screen reader cannot see.
    // Every group that renders `on` has to render the matching state as well.
    const selectable = ["tab", "filt", "who-btn", "scope-btn", "st"];
    for (const control of selectable) {
      const rendered = script.slice(script.indexOf(`class="${control} `));
      expect(rendered.slice(0, 400), `${control} has no selected state`).toContain("aria-pressed");
    }
    // The textareas render one per case and would otherwise share a placeholder.
    expect(script).toMatch(/data-note="\$\{esc\(c\.id\)\}"[^>]*aria-label=/);
    // The verdict glyphs need a spoken name; "P" is not one.
    expect(script).toContain('const SPOKEN = { pass: "pass", fail: "fail", blocked: "blocked", na: "not applicable" }');
  });

  it("caps notes at the length the API stores", () => {
    // The API slices at 4000. Without a matching cap the tester types past it,
    // the save returns ok, and the tail is gone with nothing to show for it.
    const apiLimit = readFileSync(path.join(appDir, "api", "state.ts"), "utf8").match(
      /MAX_NOTE_LENGTH = (\d+)/,
    );
    expect(apiLimit).not.toBeNull();
    expect(page).toContain(`maxlength="${apiLimit?.[1]}"`);
  });

  it("only fetches paths the local server is willing to serve", () => {
    // dev.mjs serves a fixed allowlist. A page asking for anything outside it
    // works when deployed and 404s locally — the worst kind of drift, because
    // the local run is what we use to rehearse.
    const served = readFileSync(path.join(appDir, "dev.mjs"), "utf8");
    const fetched = [...page.matchAll(/fetch\("([^"]+)"/g)]
      .map((m) => m[1])
      // The sign-in call builds its query string, so match the route not the literal.
      .map((target) => target.split("?")[0]);
    expect(fetched.length).toBeGreaterThan(0);
    for (const target of fetched) {
      if (target === "/api/state" || target === "/api/auth") continue;
      expect(served).toContain(`"/${target.replace(/^\//, "")}"`);
    }
  });

  it("falls back to the same roster the API enforces", () => {
    // The page seeds a roster before /api/state answers. If that list drifts
    // from the server's, it offers a name whose saves are rejected as unknown.
    const apiTeam = readFileSync(path.join(appDir, "api", "state.ts"), "utf8").match(
      /export const TEAM = \[([^\]]+)\]/,
    );
    const pageTeam = page.match(/if \(!TEAM\.length\) TEAM = \[([^\]]+)\]/);
    const names = (raw: string | undefined) =>
      (raw ?? "").split(",").map((part) => part.trim().replace(/^["']|["']$/g, ""));
    expect(names(pageTeam?.[1])).toEqual(names(apiTeam?.[1]));
  });
});

describe("QA app deployment contract", () => {
  it("exports named HTTP methods and no default", async () => {
    // Vercel reads a DEFAULT export as the Node `(req, res) => void` signature
    // and ignores its return value, so a default export returning a `Response`
    // writes nothing and the request hangs until the platform kills it at 300s.
    // That shipped once and read as a 504 with no error in the logs.
    const module = await import("../../packages/qa/api/state");
    expect(typeof (module as Record<string, unknown>).GET).toBe("function");
    expect(typeof (module as Record<string, unknown>).POST).toBe("function");
    expect((module as Record<string, unknown>).default).toBeUndefined();
  });

  it("routes both methods through one handler", async () => {
    const module = await import("../../packages/qa/api/state");
    const response = await module.GET(new Request("https://qa.test/api/state", { method: "DELETE" }));
    // The shared handler owns method dispatch, so an unsupported verb is a 405
    // rather than two divergent implementations.
    expect(response.status).toBe(405);
  });
});

describe("QA app build", () => {
  it("emits only active cases, with the fields the page renders", () => {
    execFileSync("node", [path.join(appDir, "build.mjs")], { stdio: "pipe" });
    const dist = path.join(appDir, "dist");
    expect(existsSync(path.join(dist, "index.html"))).toBe(true);

    const built = JSON.parse(readFileSync(path.join(dist, "catalog.json"), "utf8"));
    const source = JSON.parse(
      readFileSync(path.join(repoRoot, "scripts", "data", "qa-test-catalog.json"), "utf8"),
    );
    const retired = new Set(
      source.cases.filter((c: { status?: string }) => c.status === "retired").map((c: { id: string }) => c.id),
    );
    expect(retired.size).toBeGreaterThan(0);
    expect(built.cases.length).toBe(source.cases.length - retired.size);
    // A retired case on a run sheet is a tester walking a scenario we removed.
    for (const testCase of built.cases) expect(retired.has(testCase.id)).toBe(false);
    expect(Object.keys(built.cases[0]).sort()).toEqual(
      ["area", "expected", "id", "pri", "rd", "rp", "scenario", "tab", "tx"],
    );
  });
});
