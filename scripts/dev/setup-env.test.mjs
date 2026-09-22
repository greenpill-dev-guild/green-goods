import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dependencyReadiness, majorVersion, readPinnedNodeVersion } from "../lib/dev-shared.js";
import { createBaselineEnv } from "../lib/setup-env.mjs";
import { applyGroupEnvironment } from "./stack.js";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const bun = spawnSync("command -v bun", { shell: true, encoding: "utf8" }).stdout.trim();
const setupArguments = ["--profile", "isolated", "--install", "skip", "--env-mode", "skip"];
const pinnedNode = readPinnedNodeVersion(projectRoot);
const pinnedNodeMajor = majorVersion(pinnedNode);
// A major no Node release will ever carry, so the mismatch cannot depend on
// which Node the host installed.
const foreignNode = "99.0.0";

/** A directory whose `node` reports `version`, to be put first on PATH. */
function nodeOnPath(t, version) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "gg-node-pin-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const executable = path.join(directory, "node");
  writeFileSync(executable, `#!/bin/sh\necho ${version}\n`);
  chmodSync(executable, 0o755);
  return directory;
}

/**
 * Run a dev script under Bun with `version` first on PATH.
 *
 * `bun run <script>` puts Bun's own node shim ahead of the real one, which is
 * how `bun run dev:health` reaches the doctor and why the reported version has
 * to come from PATH rather than from `process.versions.node`. Bun as the
 * interpreter reproduces that without depending on the host's Node.
 */
function runUnderBun(t, script, args, version) {
  assert.ok(bun, "bun is required to run repository scripts");
  return spawnSync(bun, [`scripts/dev/${script}`, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${nodeOnPath(t, version)}${path.delimiter}${process.env.PATH}`,
    },
  });
}

test("fresh public baseline needs no secrets and reruns preserve an existing environment", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "gg-public-setup-"));
  try {
    assert.equal(dependencyReadiness(root).ready, false);
    assert.equal(createBaselineEnv(root, "isolated"), true);
    const baseline = readFileSync(path.join(root, ".env"), "utf8");
    assert.doesNotMatch(baseline, /PRIVATE_KEY|TOKEN|API_KEY|JWT|op:\/\//);
    assert.match(baseline, /GG_WORKSPACE_PROFILE=isolated/);
    assert.equal(createBaselineEnv(root, "host"), false);
    assert.equal(readFileSync(path.join(root, ".env"), "utf8"), baseline);
    writeFileSync(path.join(root, ".env"), "EXISTING_ENV=preserve-me\n");
    assert.equal(createBaselineEnv(root, "isolated"), false);
    assert.equal(readFileSync(path.join(root, ".env"), "utf8"), "EXISTING_ENV=preserve-me\n");
    assert.equal(applyGroupEnvironment({}, "prod").env.VITE_CHAIN_ID, "42161");
    assert.match(applyGroupEnvironment({}, "prod").env.VITE_API_BASE_URL, /^https:\/\//);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("setup stops when the Node major differs from the .mise.toml pin", (t) => {
  const mismatched = runUnderBun(t, "setup.js", setupArguments, foreignNode);
  assert.equal(mismatched.status, 1, mismatched.stdout);
  assert.match(mismatched.stdout, new RegExp(`Node\\.js v${foreignNode}`));
  assert.match(mismatched.stdout, new RegExp(`\\.mise\\.toml pins ${pinnedNode}`));
  assert.match(mismatched.stdout, /Missing required dependencies/);

  // The pinned major opens the gate; a different patch inside it is not a stop,
  // because package.json engines accepts the whole major.
  const matched = runUnderBun(t, "setup.js", setupArguments, `${pinnedNodeMajor}.0.0`);
  assert.match(matched.stdout, new RegExp(`Node\\.js v${pinnedNodeMajor}\\.0\\.0`));
  assert.doesNotMatch(matched.stdout, /Missing required dependencies/);
});

test("the doctor reports the Node on PATH against the pin, not Bun's emulated version", (t) => {
  const nodeCheck = (result) => {
    const payload = JSON.parse(result.stdout);
    return payload.results.find((entry) => entry.check === "tool:node");
  };

  const mismatched = runUnderBun(t, "doctor.js", ["--profile", "web", "--json"], foreignNode);
  const failed = nodeCheck(mismatched);
  assert.equal(failed.level, "fail");
  assert.match(failed.detail, new RegExp(`v${foreignNode}`));
  assert.match(failed.detail, new RegExp(`\\.mise\\.toml pins ${pinnedNode}`));
  assert.ok(failed.fix, "a mismatch names the repair");
  // Without this the report passes off Bun's emulated Node version as the machine's.
  assert.match(
    JSON.parse(mismatched.stdout).results.find((entry) => entry.check === "runtime:bun").detail,
    /Bun .* emulates Node/
  );

  const matched = nodeCheck(runUnderBun(t, "doctor.js", ["--profile", "web", "--json"], `${pinnedNodeMajor}.0.0`));
  assert.equal(matched.level, "pass");
  assert.equal(matched.fix, "");
});
