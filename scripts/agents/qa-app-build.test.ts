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
  const match = page.match(/<script>([\s\S]*)<\/script>/);
  if (!match) throw new Error("index.html has no inline <script>");
  return match[1];
}

describe("QA app page", () => {
  it("has an inline script that actually parses", () => {
    // `new Script` compiles without running: a missing brace or a stray `*/`
    // fails here instead of at the top of Tuesday's session.
    expect(() => new Script(inlineScript())).not.toThrow();
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
    const fetched = [...page.matchAll(/fetch\("([^"]+)"/g)].map((m) => m[1]);
    expect(fetched.length).toBeGreaterThan(0);
    for (const target of fetched) {
      if (target === "/api/state") continue;
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
