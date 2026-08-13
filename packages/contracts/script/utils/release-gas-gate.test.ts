import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACTS_ROOT, loadReleaseManifest } from "./release-manifest";

/**
 * Drift guardrail for the release gas gate routing.
 *
 * The three source-acknowledgment boundary fixtures prove the frozen batch-size limit
 * against the production artifact and are meaningless under any other codegen. They are
 * excluded by exact name from every non-production suite lane and executed only through
 * `bun run test:gas:release`. This test pins that wiring so a renamed fixture, an edited
 * exclusion, or a dropped gate chain cannot silently remove the production proof from the
 * required `bun run test` entrypoint.
 */

const packageJson = JSON.parse(fs.readFileSync(path.join(CONTRACTS_ROOT, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

const measurement = loadReleaseManifest().batching.sourceAcknowledgmentMeasurement;
const fixtures = [measurement.acceptedFixture, measurement.firstRejectedFixture, measurement.hardMaxFixture].map(
  (fixture) => {
    const [contract, test] = fixture.split(".");
    return { contract, test };
  },
);
// forge matches test filters against the full signature ("testFoo()"), so the exclusion
// must anchor over the parameterless parentheses — a bare-name `$` anchor matches nothing
// and would silently keep the boundary tests in the excluded lanes.
const exclusion = `--no-match-test '^(${fixtures.map((fixture) => fixture.test).join("|")})\\(\\)$'`;

function solidityFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return solidityFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".sol") ? [entryPath] : [];
  });
}

describe("release gas gate routing", () => {
  it("excludes the boundary fixtures by exact name from every non-production suite lane", () => {
    for (const script of ["test", "test:solidity", "test:deep", "test:fast", "test:lite"] as const) {
      expect(packageJson.scripts[script], `scripts.${script}`).toContain(exclusion);
    }
  });

  it("keeps `bun run test` a single honest entrypoint: fast suite, production gate, script tests", () => {
    const test = packageJson.scripts.test;
    const gateIndex = test.indexOf("bun run test:gas:release");
    const scriptIndex = test.indexOf("bun run test:script");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(scriptIndex).toBeGreaterThan(gateIndex);
  });

  it("routes the gate through the fail-closed production runner with per-call isolation", () => {
    expect(packageJson.scripts["test:gas:release"]).toBe("bun script/utils/run-release-gas-gate.ts");
    const runner = fs.readFileSync(path.join(CONTRACTS_ROOT, "script/utils/run-release-gas-gate.ts"), "utf8");
    expect(runner).toContain('FOUNDRY_PROFILE: "production"');
    expect(runner).toContain("--isolate");
    expect(runner).toContain("--list");
  });

  it("finds each configured fixture exactly once in the Solidity test tree", () => {
    const sources = solidityFiles(path.join(CONTRACTS_ROOT, "test")).map((file) => ({
      file,
      content: fs.readFileSync(file, "utf8"),
    }));
    for (const fixture of fixtures) {
      const declarations = sources.flatMap(({ file, content }) => {
        const matches = content.match(new RegExp(`function ${fixture.test}\\(`, "g")) ?? [];
        return matches.map(() => file);
      });
      expect(declarations, `${fixture.contract}.${fixture.test}`).toHaveLength(1);
      const declaringSource = sources.find(({ file }) => file === declarations[0]);
      expect(declaringSource?.content, `${fixture.test} must live in ${fixture.contract}`).toContain(
        `contract ${fixture.contract}`,
      );
    }
  });
});
