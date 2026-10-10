/**
 * Runs a small fixture suite under the real shared-graph setup: one worker, one module graph, and
 * files in a fixed order, so each leak is followed by a file that would see it. The guards must
 * fail the file that causes a leak and leave the next one clean.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const sharedGraphSetup = path.resolve(here, "../setupTests.shared-graph.ts");
const vitestCli = path.join(
  path.dirname(createRequire(import.meta.url).resolve("vitest/package.json")),
  "vitest.mjs"
);

const FIXTURE_FILES: Record<string, string> = {
  "counter.ts": "let count = 0;\nexport const next = () => ++count;\n",
  "flag-helper.ts":
    'export const installFlag = () => {\n  (globalThis as Record<string, unknown>).__sharedGraphFlag = "set";\n};\n',
  // Module state: both files count from one only if each gets a fresh copy of counter.ts.
  "a-counts.test.ts": 'import { next } from "./counter";\nit("counts", () => expect(next()).toBe(1));\n',
  "b-counts.test.ts": 'import { next } from "./counter";\nit("counts", () => expect(next()).toBe(1));\n',
  // A global a helper writes during a test.
  "c-leaks-global.test.ts":
    'import { installFlag } from "./flag-helper";\nit("installs", () => installFlag());\n',
  "d-sees-global.test.ts":
    'it("starts clean", () => expect((globalThis as Record<string, unknown>).__sharedGraphFlag).toBeUndefined());\n',
  // A navigator property a test defines, as the Web Locks helper does. The core setup resets
  // navigator.onLine after each test, so it cannot stand in here.
  "e-leaks-navigator.test.ts":
    'it("adds a lock manager", () => {\n  Object.defineProperty(navigator, "__sharedGraphLocks", { configurable: true, value: {} });\n});\n',
  "f-sees-navigator.test.ts":
    'it("starts without it", () => expect(Object.getOwnPropertyDescriptor(navigator, "__sharedGraphLocks")).toBeUndefined());\n',
  // Spying on clearTimeout under fake timers leaves a spy whose original is the fake clock's
  // clearTimeout; restoreMocks would put it back at the next file's first test.
  "g-leaks-clock.test.ts": [
    'it("clears", () => {',
    "  vi.useFakeTimers();",
    '  const spy = vi.spyOn(globalThis, "clearTimeout");',
    "  clearTimeout(setTimeout(() => {}, 10));",
    "  spy.mockRestore();",
    "  vi.useRealTimers();",
    "});",
  ].join("\n"),
  "h-sees-clock.test.ts":
    'it("has the real clearTimeout", () => expect(String(clearTimeout)).not.toContain("clock"));\n',
};

const FIXTURE_CONFIG = `export default {
  test: {
    root: ${JSON.stringify("__ROOT__")},
    include: ["*.test.ts"],
    environment: "node",
    globals: true,
    pool: "threads",
    maxWorkers: 1,
    isolate: false,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    setupFiles: [${JSON.stringify(sharedGraphSetup)}],
    sequence: {
      sequencer: class {
        async sort(files) {
          return [...files].sort((left, right) => left.moduleId.localeCompare(right.moduleId));
        }
        async shard(files) {
          return files;
        }
      },
    },
  },
};
`;

interface FileResult {
  status: string;
  message: string;
  failedTests: number;
}

let fixtureRoot = "";
let results = new Map<string, FileResult>();

beforeAll(() => {
  fixtureRoot = mkdtempSync(path.join(tmpdir(), "shared-graph-isolation-"));
  for (const [name, source] of Object.entries(FIXTURE_FILES)) {
    writeFileSync(path.join(fixtureRoot, name), source);
  }
  const configPath = path.join(fixtureRoot, "vitest.config.mjs");
  writeFileSync(configPath, FIXTURE_CONFIG.replace('"__ROOT__"', JSON.stringify(fixtureRoot)));
  const reportPath = path.join(fixtureRoot, "report.json");
  // The nested run must not inherit this run's worker identity.
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("VITEST"))
  );
  spawnSync(
    process.execPath,
    [vitestCli, "run", "--config", configPath, "--reporter=json", `--outputFile=${reportPath}`],
    { cwd: fixtureRoot, env: environment, encoding: "utf8", timeout: 90_000 }
  );
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
    testResults: {
      name: string;
      status: string;
      message: string;
      assertionResults: { status: string }[];
    }[];
  };
  results = new Map(
    report.testResults.map((file) => [
      path.basename(file.name),
      {
        status: file.status,
        message: file.message,
        failedTests: file.assertionResults.filter((test) => test.status === "failed").length,
      },
    ])
  );
}, 120_000);

afterAll(() => {
  if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("the shared module graph", () => {
  it("gives each file fresh copies of the modules it imports", () => {
    expect(results.get("a-counts.test.ts")?.status).toBe("passed");
    expect(results.get("b-counts.test.ts")?.status).toBe("passed");
  });

  it("fails the file whose test leaves a global, and puts the global back", () => {
    expect(results.get("c-leaks-global.test.ts")).toMatchObject({ status: "failed", failedTests: 0 });
    expect(results.get("c-leaks-global.test.ts")?.message).toContain("__sharedGraphFlag added");
    expect(results.get("d-sees-global.test.ts")?.status).toBe("passed");
  });

  it("fails the file whose test defines a navigator property, and puts it back", () => {
    expect(results.get("e-leaks-navigator.test.ts")?.message).toContain("navigator.__sharedGraphLocks added");
    expect(results.get("f-sees-navigator.test.ts")?.status).toBe("passed");
  });

  it("fails the file that leaves the fake clock's clearTimeout installed", () => {
    expect(results.get("g-leaks-clock.test.ts")?.message).toContain("clearTimeout replaced");
    expect(results.get("h-sees-clock.test.ts")?.status).toBe("passed");
  });
});
