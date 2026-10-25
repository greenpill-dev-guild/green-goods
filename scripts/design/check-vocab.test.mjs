/** @direct-test-command ./check-vocab.sh */
// TEST-QUALITY: allow-small-test-file - check-vocab.sh had no test file; this ICU branch regression is its first, and it runs the real script on a scratch catalog.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve(import.meta.dirname, "check-vocab.sh");
// The real Brazilian Portuguese rules, so the test proves what the catalog is held to.
const { pt_brazilian } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../data/banned-vocabulary.json"), "utf8"),
);

// Runs the check in a scratch repository whose English (and, if given, Portuguese) catalog holds
// only the given messages, with an optional nested QA app locale.
function check(messages, ptMessages = {}, qaPtLocale = {}) {
  const root = mkdtempSync(join(tmpdir(), "check-vocab-"));
  try {
    for (const directory of ["scripts/design", "scripts/data", "packages/shared/src/i18n", "packages/qa/locales"]) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    writeFileSync(join(root, "packages/qa/locales/pt.json"), JSON.stringify(qaPtLocale));
    copyFileSync(script, join(root, "scripts/design/check-vocab.sh"));
    writeFileSync(
      join(root, "scripts/data/banned-vocabulary.json"),
      JSON.stringify({
        linter_enforced: { terms: ["fomo"] },
        us_spelling: { globs: ["packages/shared/src/i18n/en.json"], terms: { cancelled: "canceled" } },
        pt_brazilian,
      }),
    );
    writeFileSync(join(root, "packages/shared/src/i18n/en.json"), JSON.stringify(messages));
    writeFileSync(join(root, "packages/shared/src/i18n/pt.json"), JSON.stringify(ptMessages));
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

test("Portuguese copy fails on European forms, nested QA strings included, and passes the Brazilian lookalikes", () => {
  const european = check({}, { "pool.ask": "A tua carteira vai pedir-te mais uma vez.", "pool.pause": "O grupo está a reorganizar-se." });
  assert.equal(european.status, 1, european.stdout + european.stderr);
  assert.match(european.stdout, /pt\.json: pool\.ask: .*-te.*tua|pt\.json: pool\.ask: .*tua.*-te/);
  assert.match(european.stdout, /pt\.json: pool\.pause: está a reorganizar/);

  const brazilian = check({}, {
    "pool.take": "Aceite uma destas promessas.",
    "pool.aware": "Ela já está a par do pedido.",
    "pool.count": "{tua, plural, one {# promessa} other {# promessas}}",
    "pool.steps": "Siga as instruções precisas.",
  });
  assert.equal(brazilian.status, 0, brazilian.stdout + brazilian.stderr);

  const qa = check({}, {}, { ui: { carry: "Veredictos registados nesta rodada" } });
  assert.equal(qa.status, 1, qa.stdout + qa.stderr);
  assert.match(qa.stdout, /qa\/locales\/pt\.json: ui\.carry: registados/);
});
