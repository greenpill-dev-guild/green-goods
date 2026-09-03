import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
const apiDir = path.join(appDir, "api");
const endpointFiles = readdirSync(apiDir).filter((file) => file.endsWith(".ts")).sort();
const page = readFileSync(path.join(appDir, "index.html"), "utf8");

function inlineScript(id: "theme-bootstrap" | "qa-app"): string {
  // Literal slicing rather than a tag-shaped regex. This is not sanitizing
  // hostile HTML — it reads one file we author — but a regex that pattern-
  // matches an HTML tag reads as a broken sanitizer to scanners, and the
  // string search is both clearer and exactly as correct here.
  const OPEN = `<script id="${id}">`;
  const start = page.indexOf(OPEN);
  const end = page.indexOf("</script>", start);
  if (start < 0 || end < start) throw new Error(`index.html has no ${id} script`);
  return page.slice(start + OPEN.length, end);
}

function sourceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  if (from < 0 || to < from) throw new Error(`Could not find source between ${start} and ${end}`);
  return source.slice(from, to);
}

describe("QA app page", () => {
  it("has theme bootstrap and app scripts that both parse", () => {
    // `new Script` compiles without running: a missing brace or a stray `*/`
    // fails here instead of at the top of Tuesday's session.
    expect(() => new Script(inlineScript("theme-bootstrap"))).not.toThrow();
    expect(() => new Script(inlineScript("qa-app"))).not.toThrow();
  });

  it("applies and persists System, Light, and Dark before first paint", () => {
    expect(page).toContain('<meta name="color-scheme" content="light dark">');
    expect(page.indexOf('<script id="theme-bootstrap">')).toBeLessThan(page.indexOf("<style>"));

    const saved = new Map<string, string>([["qa-theme", "dark"]]);
    const root = { dataset: {} as Record<string, string>, style: { colorScheme: "" } };
    const meta = { content: "light dark" };
    const context = {
      document: {
        documentElement: root,
        querySelector: () => meta,
      },
      localStorage: {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => saved.set(key, value),
      },
    } as {
      document: unknown;
      localStorage: unknown;
      qaTheme?: { apply: (theme: string, persist: boolean) => string };
    };

    new Script(inlineScript("theme-bootstrap")).runInNewContext(context);
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
    expect(meta.content).toBe("dark");

    context.qaTheme?.apply("light", true);
    expect(saved.get("qa-theme")).toBe("light");
    expect(root.dataset.theme).toBe("light");
    expect(meta.content).toBe("light");

    context.qaTheme?.apply("system", true);
    expect(saved.get("qa-theme")).toBe("system");
    expect(root.dataset.theme).toBeUndefined();
    expect(root.style.colorScheme).toBe("light dark");
    expect(meta.content).toBe("light dark");
  });

  it("does not let overlay display rules override the hidden state", () => {
    // The sign-in panel is a full-screen grid. Without an author-level hidden
    // rule, `.signin { display: grid }` wins over the browser stylesheet after
    // authentication: the session succeeds underneath, but the wallet prompt
    // remains visible and sends the tester through another signature attempt.
    const hiddenRule = page.match(/\[hidden\]\s*\{([^}]*)\}/)?.[1];
    expect(hiddenRule, "index.html must force hidden overlays out of layout").toMatch(
      /display\s*:\s*none\s*!important/,
    );
  });

  it("gives every selectable control a selected state and every note a name", () => {
    const script = inlineScript("qa-app");
    // Selection lived only in the `on` class, which a screen reader cannot see.
    // Every group that renders `on` has to render the matching state as well.
    const selectable = ["tab", "filt", "ord", "st"];
    for (const control of selectable) {
      const rendered = script.slice(script.indexOf(`class="${control} `));
      expect(rendered.slice(0, 400), `${control} has no selected state`).toContain("aria-pressed");
    }
    // The textareas render one per case and would otherwise share a placeholder.
    expect(script).toMatch(/data-note="\$\{esc\(testCase\.id\)\}"[^>]*aria-label=/);
    // The verdict glyphs need a spoken name; "P" is not one.
    expect(script).toContain('const SPOKEN = { pass: "pass", fail: "fail", blocked: "blocked", na: "not applicable" }');
  });

  it("does not render the obsolete testing-as selector", () => {
    // The session cookie fixes the writer to the wallet that signed in. A row
    // of tester-shaped controls implies that attribution can be changed even
    // when every button is disabled, and duplicates the roster beside the
    // real showing filter.
    expect(page).not.toContain('class="who-btn');
    expect(page).not.toContain('class="who-group');
    expect(page).not.toContain('>testing as<');
  });

  it("separates the read-only Overview from personal recording", () => {
    const script = inlineScript("qa-app");
    const overview = sourceBetween(script, "function renderOverviewRows", "function renderPersonRows");
    const personal = sourceBetween(script, "function renderPersonRows", "function matchesCurrentView");

    expect(page).not.toContain("Everyone");
    expect(overview).toContain('class="person-status');
    expect(overview).toContain("data-notes-toggle");
    expect(overview).not.toContain("data-note=");
    expect(overview).not.toContain('class="st ');
    expect(personal).toContain("const editable = selected === who");
    expect(personal).toContain('class="readonly-status');
    expect(personal).toContain("data-note=");
  });

  it("scopes filters and defaults to the signed-in tester", () => {
    const script = inlineScript("qa-app");
    const matching = sourceBetween(script, "function matchesCurrentView", "// ── Render");

    expect(matching).toContain('if (scope === null)');
    expect(matching).toContain('if (filter === "issues") return isIssue(testCase.id)');
    expect(matching).toContain('if (filter === "open") return !verdict(testCase.id)');
    expect(matching).toContain("if (scope !== who && !entry) return false");
    expect(matching).toContain('if (filter === "issues") return isPersonIssue(testCase.id, scope)');
    expect(matching).toContain('if (filter === "open") return !statusFor(testCase.id, scope)');
    expect(script).toContain('const storedScope = view.scope === "all" ? OVERVIEW : view.scope');
    expect(script).toContain(
      "scope = storedScope === OVERVIEW ? null : TEAM.includes(storedScope) ? storedScope : who || null",
    );
  });

  it("keeps tabs and view controls together, then filters and summary together", () => {
    // These are the two scan lines a tester uses throughout a walk. Keep each
    // pair in one flex row so wide screens do not spend four lines on controls.
    expect(page).toMatch(/class="header-row tab-row"[\s\S]*class="tabs"[\s\S]*class="scoperow"/);
    expect(page).toMatch(/class="header-row filter-row"[\s\S]*class="filters"[\s\S]*class="counts"/);
  });

  it("stacks case controls before they can overflow a phone viewport", () => {
    // At 375px the desktop three-column row put the final verdict button and
    // note field beyond the viewport. The phone layout keeps the scenario in
    // column two, then gives controls and notes their own rows.
    expect(page).toMatch(/@media \(max-width:720px\)[\s\S]*\.row\s*\{[^}]*grid-template-columns:72px minmax\(0,1fr\)/);
    expect(page).toMatch(/@media \(max-width:720px\)[\s\S]*\.ctl\s*\{[^}]*grid-column:2/);
    expect(page).toMatch(/@media \(max-width:720px\)[\s\S]*\.note\s*\{[^}]*grid-column:1 \/ -1/);
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

  it("loads the generated Warm Earth radius tokens", () => {
    const dev = readFileSync(path.join(appDir, "dev.mjs"), "utf8");
    expect(page).toContain('<link rel="stylesheet" href="design-md.generated.css">');
    expect(dev).toContain('["/design-md.generated.css", "design-md.generated.css"]');
    expect(dev).toContain('".css": "text/css; charset=utf-8"');
    expect(page).toMatch(/--radius-md\s*:\s*var\(--gg-radius-md\)/);
    expect(page).toMatch(/--radius-full\s*:\s*var\(--gg-radius-full\)/);
    expect(page).toMatch(/\.journey-chip\s*\{[^}]*border-radius\s*:\s*var\(--radius-full\)/s);
    expect(page).toMatch(
      /\.journey-handoff, \.known-gate\s*\{[^}]*border-radius\s*:\s*0 var\(--radius-md\) var\(--radius-md\) 0/s,
    );
  });

  it("names an unnamed tester the same way on both sides", () => {
    // Shards are keyed by address and the display name is self-declared, so
    // there is no roster to agree on any more — but a tester who has not named
    // themselves must read identically in the page and in the pulled run sheet,
    // or the same person appears as two people.
    const api = readFileSync(path.join(appDir, "api", "state.ts"), "utf8");
    const cli = readFileSync(path.join(repoRoot, "scripts", "agents", "qa-state.ts"), "utf8");
    const shape = /address\.slice\(0, 6\)\}…\$\{address\.slice\(-4\)/;
    expect(api).toMatch(shape);
    expect(cli).toMatch(shape);
  });
});

describe("QA app deployment contract", () => {
  it("exports named HTTP methods and no default from every endpoint", async () => {
    // Vercel reads a DEFAULT export as the Node `(req, res) => void` signature
    // and ignores its return value, so a default export returning a `Response`
    // writes nothing and the request hangs until the platform kills it at 300s.
    // That shipped once and read as a 504 with no error in the logs.
    for (const file of endpointFiles) {
      const source = readFileSync(path.join(apiDir, file), "utf8");
      expect(source, `${file} has a default export`).not.toMatch(/export\s+default\b/);
      const module = await import(pathToFileURL(path.join(apiDir, file)).href);
      expect(typeof (module as Record<string, unknown>).GET, `${file}.GET`).toBe("function");
      expect(typeof (module as Record<string, unknown>).POST, `${file}.POST`).toBe("function");
      if (file === "auth.ts") expect(typeof (module as Record<string, unknown>).DELETE).toBe("function");
      expect((module as Record<string, unknown>).default).toBeUndefined();
    }
  });

  it("loads every endpoint module, so a dead import cannot reach production", async () => {
    // The endpoints were never imported by a test — only the modules they use.
    // So `api/auth.ts` kept importing `findAllowed` after a refactor removed it,
    // every local test passed, and the deployed function died at load with
    // "does not provide an export named". Importing them here is the whole fix:
    // a stale import fails at module evaluation, which is exactly what happened
    // in production.
    for (const file of endpointFiles) {
      await expect(import(pathToFileURL(path.join(apiDir, file)).href), file).resolves.toBeTypeOf("object");
    }
  });

  it("gives every relative import an explicit extension", () => {
    // Vercel compiles these to ESM, and Node's resolver will not guess an
    // extension on a relative import. Extensionless `../auth` compiled fine,
    // passed every local test, and crashed the deployed function at load with
    // ERR_MODULE_NOT_FOUND. TypeScript wants `.js` here even though the source
    // is `.ts`.
    for (const file of endpointFiles) {
      const source = readFileSync(path.join(apiDir, file), "utf8");
      const relative = [
        ...source.matchAll(/(?:from\s+|import\s+|import\()\s*(["'`])(\.[^"'`]+)\1/g),
      ].map(
        (match) => match[2],
      );
      for (const specifier of relative) {
        expect(specifier, `${file} imports ${specifier}`).toMatch(/\.(js|mjs|json)$/);
      }
    }
  });

  it("routes both methods through one handler", async () => {
    const module = await import("../../packages/qa/api/state");
    const response = await module.GET(new Request("https://qa.test/api/state", { method: "DELETE" }));
    // The shared handler owns method dispatch, so an unsupported verb is a 405
    // rather than two divergent implementations.
    expect(response.status).toBe(405);
  });

  it("keeps the loopback identity bypass out of deployment inputs", () => {
    const vercel = JSON.parse(readFileSync(path.join(appDir, "vercel.json"), "utf8"));
    expect(vercel.outputDirectory).toBe("dist");
    const dev = readFileSync(path.join(appDir, "dev.mjs"), "utf8");
    expect(dev).toContain('server.listen(port, "127.0.0.1"');
    for (const file of endpointFiles) {
      const source = readFileSync(path.join(apiDir, file), "utf8");
      expect(source).not.toContain("qa_dev_person");
      expect(source).not.toContain('searchParams.get("as")');
    }
  });
});

describe("QA app build", () => {
  it("emits only active cases, with the fields the page renders", () => {
    execFileSync("node", [path.join(appDir, "build.mjs")], { stdio: "pipe" });
    const dist = path.join(appDir, "dist");
    expect(existsSync(path.join(dist, "index.html"))).toBe(true);
    expect(readFileSync(path.join(dist, "design-md.generated.css"), "utf8")).toBe(
      readFileSync(path.join(repoRoot, "packages", "shared", "src", "styles", "design-md.generated.css"), "utf8"),
    );

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
      ["area", "expected", "id", "pri", "rd", "rp", "scenario", "steps", "tab", "tx"],
    );
    expect(built.journeys.map((journey: { id: string }) => journey.id)).toEqual([
      "service-relay",
      "protocol-treasury-top-up",
    ]);
    const activeIds = new Set(built.cases.map((testCase: { id: string }) => testCase.id));
    const journeyCaseIds = new Set<string>();
    for (const journey of built.journeys) {
      for (const step of journey.steps) {
        expect(activeIds.has(step.caseId)).toBe(true);
        journeyCaseIds.add(step.caseId);
      }
    }
    const gated = built.journeys.flatMap((journey: { steps: Array<{ knownGate?: string }> }) =>
      journey.steps.filter((step) => step.knownGate),
    );
    expect(gated).toHaveLength(3);
    expect(gated.every((step: { knownGate: string }) => step.knownGate.trim().length > 0)).toBe(true);
    expect(Object.keys(built.locales).sort()).toEqual(["en", "es", "pt"]);
    for (const locale of Object.values(built.locales) as Array<{
      ui: Record<string, string>;
      journeys: Record<string, unknown>;
      cases: Record<string, { scenario: string; steps: string[]; expected: string }>;
    }>) {
      expect(locale.ui.journey.trim()).not.toBe("");
      expect(locale.ui.roleRequirements.trim()).not.toBe("");
      expect(Object.keys(locale.journeys).sort()).toEqual([
        "protocol-treasury-top-up",
        "service-relay",
      ]);
      expect(Object.keys(locale.cases).sort()).toEqual([...journeyCaseIds].sort());
      for (const copy of Object.values(locale.cases)) {
        expect(copy.scenario.trim()).not.toBe("");
        expect(copy.steps.every((step) => step.trim().length > 0)).toBe(true);
        expect(copy.expected.trim()).not.toBe("");
      }
    }
  });
});

describe("QA catalog contract", () => {
  it("locks the six kinds and keeps transaction exactly aligned with the tx tag", () => {
    const catalog = JSON.parse(
      readFileSync(path.join(repoRoot, "scripts", "data", "qa-test-catalog.json"), "utf8"),
    );
    const expectedKindIds = [
      "journey",
      "transaction",
      "data-integrity",
      "content",
      "accessibility",
      "resilience",
    ];
    const kindIds = catalog.kinds.map((kind: { id: string }) => kind.id);
    expect(kindIds).toEqual(expectedKindIds);
    expect(new Set(kindIds).size).toBe(expectedKindIds.length);
    for (const kind of catalog.kinds) {
      expect(kind.label.trim()).not.toBe("");
      expect(kind.verifies.trim()).not.toBe("");
    }
    const kinds = new Set(kindIds);
    for (const testCase of catalog.cases) {
      expect(kinds.has(testCase.kind)).toBe(true);
      // The write boundary is negotiated per session, so the transaction kind
      // and the tx tag must never drift apart.
      expect(testCase.kind === "transaction").toBe(Boolean(testCase.tags?.includes("tx")));
    }
  });

  it("enshrines the case lifecycle: active or retired, every retirement dated and explained", () => {
    const catalog = JSON.parse(
      readFileSync(path.join(repoRoot, "scripts", "data", "qa-test-catalog.json"), "utf8"),
    );
    expect(catalog.statuses.map((status: { id: string }) => status.id)).toEqual(["active", "retired"]);
    const activeIds = new Set(
      catalog.cases
        .filter((testCase: { status: string }) => testCase.status === "active")
        .map((testCase: { id: string }) => testCase.id),
    );
    const seen = new Set<string>();
    for (const testCase of catalog.cases) {
      // IDs are permanent addresses: an OBS record or a Linear slice keyed on one
      // must never resolve to a different check later.
      expect(seen.has(testCase.id)).toBe(false);
      seen.add(testCase.id);
      expect(["active", "retired"]).toContain(testCase.status);
      expect(["P0", "P1", "P2"]).toContain(testCase.priority);
      expect(String(testCase.source ?? "").trim()).not.toBe("");
      if (testCase.status === "retired") {
        const retiredOn = String(testCase.retiredOn ?? "");
        // Shape and calendar validity together: "2026-02-31" round-trips to another day.
        expect(new Date(`${retiredOn}T00:00:00.000Z`).toISOString().slice(0, 10)).toBe(retiredOn);
        expect(String(testCase.retiredReason ?? "").trim()).not.toBe("");
        for (const successor of testCase.replacedBy ?? []) expect(activeIds.has(successor)).toBe(true);
      } else {
        expect(testCase.retiredOn).toBeUndefined();
        expect(testCase.retiredReason).toBeUndefined();
        expect(testCase.replacedBy).toBeUndefined();
      }
    }
  });

  it("keeps every issued Test ID registered in the append-only ledger", () => {
    const catalog = JSON.parse(
      readFileSync(path.join(repoRoot, "scripts", "data", "qa-test-catalog.json"), "utf8"),
    );
    const ledger = JSON.parse(
      readFileSync(path.join(repoRoot, "scripts", "data", "qa-test-id-ledger.json"), "utf8"),
    );
    const ledgerIds: string[] = ledger.ids;
    expect(new Set(ledgerIds).size).toBe(ledgerIds.length);
    // Duplicate detection inside one snapshot cannot see a deleted case whose id a
    // later revision reuses; the ledger keeps every issued id visible across
    // revisions, so deleting or reusing one becomes a two-file act reviewers see.
    const catalogIds = catalog.cases.map((testCase: { id: string }) => testCase.id);
    expect([...catalogIds].sort()).toEqual([...ledgerIds].sort());
  });

  it("keeps the concurrent steward decision inside the session write boundary", () => {
    const catalog = JSON.parse(
      readFileSync(path.join(repoRoot, "scripts", "data", "qa-test-catalog.json"), "utf8"),
    );
    const concurrentReview = catalog.cases.find(
      (testCase: { id: string }) => testCase.id === "XPLAT-007",
    );

    expect(concurrentReview).toMatchObject({
      kind: "transaction",
      tags: expect.arrayContaining(["tx"]),
    });
  });
});
