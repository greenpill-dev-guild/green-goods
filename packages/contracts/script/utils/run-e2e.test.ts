import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

function runFixture(mode: string | undefined, failAfter = 0) {
  const root = mkdtempSync(path.join(tmpdir(), "gg-e2e-selection-"));
  const contracts = path.join(root, "packages/contracts");
  const scripts = path.join(contracts, "script/utils");
  const bin = path.join(root, "bin");
  const log = path.join(root, "calls");
  mkdirSync(scripts, { recursive: true });
  mkdirSync(bin);
  copyFileSync(new URL("./run-e2e.sh", import.meta.url), path.join(scripts, "run-e2e.sh"));
  // This is a disposable, non-secret environment, never the checkout's environment.
  writeFileSync(path.join(root, ".env"), "");
  writeFileSync(log, "");
  writeFileSync(path.join(bin, "bun"), '#!/bin/bash\nprintf "build|%s\\n" "$*" >> "$CALL_LOG"\n', { mode: 0o755 });
  writeFileSync(path.join(bin, "cast"), '#!/bin/bash\nprintf "pin|%s\\n" "$*" >> "$CALL_LOG"\nprintf "42\\n"\n', {
    mode: 0o755,
  });
  writeFileSync(
    path.join(bin, "forge"),
    `#!/bin/bash
printf '%s|%s|%s|%s|%s|%s\n' "$FOUNDRY_PROFILE" "$PWD" "$SEPOLIA_FORK_BLOCK_NUMBER" "$ARBITRUM_FORK_BLOCK_NUMBER" "$CELO_FORK_BLOCK_NUMBER" "$*" >> "$CALL_LOG"
if [ "$FAIL_AFTER" -gt 0 ]; then
  count=$(grep -cE '^(e2e|fork)\\|' "$CALL_LOG")
  if [ "$count" -eq "$FAIL_AFTER" ]; then exit 17; fi
fi
`,
    { mode: 0o755 },
  );
  try {
    const result = spawnSync(
      "bash",
      [path.join(scripts, "run-e2e.sh"), ...(mode ? [mode, "--match-test", "testSelected"] : [])],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 10_000,
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          CALL_LOG: log,
          FAIL_AFTER: String(failAfter),
          SEPOLIA_RPC_URL: "https://sepolia.example",
          ARBITRUM_RPC_URL: "https://arbitrum.example",
          CELO_RPC_URL: "https://celo.example",
          SEPOLIA_FORK_BLOCK_NUMBER: "11",
          ARBITRUM_FORK_BLOCK_NUMBER: "22",
          CELO_FORK_BLOCK_NUMBER: "33",
        },
      },
    );
    const lines = readFileSync(log, "utf8").trim().split("\n");
    return { ...result, contracts, lines };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const workflow = "e2e|test --match-contract E2EWorkflowForkTest -vv";
const karma = [
  "fork|test --match-contract ArbitrumKarmaGAPForkTest -vv",
  "fork|test --match-contract SepoliaKarmaGAPForkTest -vv",
];
const sepolia = [
  "e2e|test --match-path test/fork/e2e/FullProtocolE2E.t.sol -vvv",
  "e2e|test --match-path test/fork/e2e/SepoliaExtendedE2E.t.sol -vvv",
];
const arbitrum = "e2e|test --match-path test/fork/e2e/Arbitrum*.t.sol -vvv";
const full = [workflow, ...karma, ...sepolia, arbitrum];

function selectedCalls(result: ReturnType<typeof runFixture>) {
  return result.lines.slice(1).map((line) => {
    const [profile, cwd, sepoliaPin, arbitrumPin, celoPin, ...args] = line.split("|");
    expect(cwd).toBe(result.contracts);
    expect([sepoliaPin, arbitrumPin, celoPin]).toEqual(["11", "22", "33"]);
    return `${profile}|${args.join("|")}`;
  });
}

describe("argument-selected contract E2E suites", () => {
  it.each([
    ["workflow", [workflow]],
    ["karma", karma],
    ["sepolia", sepolia],
    ["arbitrum", [arbitrum]],
    ["celo", ["fork|test --match-test testFork.*Celo|test_celo.* -vvv"]],
    ["full", full],
  ] as const)("preserves %s profiles, order, pins, and forwarded arguments", (mode, expected) => {
    const result = runFixture(mode);
    expect(result.status, result.stderr).toBe(0);
    expect(result.lines[0]).toBe("build|run build");
    expect(selectedCalls(result)).toEqual(expected.map((call) => `${call} --match-test testSelected`));
  });

  it("defaults to the complete suite when no mode is provided", () => {
    const result = runFixture(undefined);
    expect(result.status, result.stderr).toBe(0);
    expect(selectedCalls(result)).toEqual(full);
  });

  it("stops at the first failing test invocation and preserves its exit status", () => {
    const result = runFixture("full", 2);
    expect(result.status).toBe(17);
    expect(selectedCalls(result)).toEqual(full.slice(0, 2).map((call) => `${call} --match-test testSelected`));
  });

  it("rejects an unknown suite without invoking build, RPC, or tests", () => {
    const result = runFixture("unknown");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown E2E mode");
    expect(result.lines).toEqual([""]);
  });
});
