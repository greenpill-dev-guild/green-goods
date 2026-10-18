/** @direct-test-command ./check-vocab.sh */
// TEST-QUALITY: allow-small-test-file - check-vocab.sh had no test file; this ICU branch regression is its first, and it runs the real script on a scratch catalog.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve(import.meta.dirname, "check-vocab.sh");

// Runs the check in a scratch repository whose English catalog holds only the given messages.
function check(messages) {
  const root = mkdtempSync(join(tmpdir(), "check-vocab-"));
  try {
    for (const directory of ["scripts/design", "scripts/data", "packages/shared/src/i18n"]) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    copyFileSync(script, join(root, "scripts/design/check-vocab.sh"));
    writeFileSync(
      join(root, "scripts/data/banned-vocabulary.json"),
      JSON.stringify({
        linter_enforced: { terms: ["fomo"] },
        us_spelling: { globs: ["packages/shared/src/i18n/en.json"], terms: { cancelled: "canceled" } },
      }),
    );
    writeFileSync(join(root, "packages/shared/src/i18n/en.json"), JSON.stringify(messages));
    return spawnSync("bash", [join(root, "scripts/design/check-vocab.sh")], { encoding: "utf8" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("US spelling reads ICU branch text, one-word branches included, and skips the keys that choose them", () => {
  const keys = check({ "app.state": "{state, select, cancelled {Stopped} other {Open}}" });
  assert.equal(keys.status, 0, keys.stdout + keys.stderr);

  const branch = check({ "app.state": "{state, select, stopped {cancelled} other {open}}" });
  assert.equal(branch.status, 1, branch.stdout + branch.stderr);
  assert.match(branch.stdout, /en\.json: app\.state: cancelled -> canceled/);
});
