import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT_PATH = join(REPO_ROOT, "scripts", "contracts", "verify-production.sh");
const CONTRACTS_DIR = join(REPO_ROOT, "packages", "contracts");

test("runs every verification tool from the contracts package", () => {
  const fixture = mkdtempSync(join(tmpdir(), "contracts-verifier-"));
  const binDir = join(fixture, "bin");
  const invocationLog = join(fixture, "invocations.log");
  mkdirSync(binDir);

  const fakeTool = [
    "#!/bin/sh",
    'printf \'%s|%s\\n\' "${0##*/}" "$PWD" >> "$VERIFY_LOG"',
    "exit 0",
    "",
  ].join("\n");

  for (const tool of ["bun", "forge", "solhint"]) {
    const toolPath = join(binDir, tool);
    writeFileSync(toolPath, fakeTool);
    chmodSync(toolPath, 0o755);
  }

  try {
    const result = spawnSync(
      "/bin/bash",
      [SCRIPT_PATH, "--skip-e2e", "--skip-dry-run"],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
          VERIFY_LOG: invocationLog,
        },
      },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const invocations = readFileSync(invocationLog, "utf8").trim().split("\n");
    assert.ok(invocations.length >= 4, `expected verifier calls, received: ${invocations.join(", ")}`);
    for (const invocation of invocations) {
      assert.equal(invocation.split("|")[1], CONTRACTS_DIR, invocation);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
