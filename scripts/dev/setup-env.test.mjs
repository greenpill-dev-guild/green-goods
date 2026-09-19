import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { dependencyReadiness } from "../lib/dev-shared.js";
import { createBaselineEnv } from "../lib/setup-env.mjs";
import { applyGroupEnvironment } from "./stack.js";

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
