import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT_PATH = join(REPO_ROOT, "scripts", "design", "check-css-custom-properties.mjs");

function futureDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 30);
  return date.toISOString().slice(0, 10);
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "css-custom-properties-"));
  mkdirSync(join(root, "packages", "shared", "src", "styles"), { recursive: true });
  mkdirSync(join(root, "packages", "client", "src"), { recursive: true });
  return root;
}

function runChecker(root, baselinePath = join(root, "scripts", "data", "css-custom-property-baseline.tsv")) {
  return spawnSync(
    process.execPath,
    [SCRIPT_PATH, "--root", root, "--baseline", baselinePath],
    { cwd: root, encoding: "utf8" },
  );
}

function withFixture(work) {
  const root = createFixture();
  try {
    return work(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("fails undefined custom properties without fallbacks", () =>
  withFixture((root) => {
    writeFileSync(
      join(root, "packages", "shared", "src", "styles", "theme.css"),
      ":root { --defined-token: 1rem; }\n",
    );
    writeFileSync(
      join(root, "packages", "client", "src", "index.css"),
      ".ok { margin: var(--defined-token); }\n.bad { color: var(--missing-token); }\n",
    );

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /--missing-token/);
    assert.match(result.stdout, /packages\/client\/src\/index\.css:2/);
  }));

test("allows fallbacks, external runtime variables, and audited baseline entries", () =>
  withFixture((root) => {
    mkdirSync(join(root, "scripts", "data"), { recursive: true });
    writeFileSync(
      join(root, "packages", "shared", "src", "styles", "theme.css"),
      ":root { --defined-token: 1rem; }\n",
    );
    writeFileSync(
      join(root, "packages", "client", "src", "index.css"),
      [
        ".ok { margin: var(--defined-token); }",
        ".fallback { color: var(--missing-with-fallback, #fff); }",
        ".runtime { height: var(--radix-select-trigger-height); }",
        ".legacy { color: var(--legacy-token); }",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(root, "scripts", "data", "css-custom-property-baseline.tsv"),
      [
        "# variable\tpath\tcategory\towner\texpires\tnote",
        `--legacy-token\tpackages/client/src/index.css\tlegacy-runtime\tcodex\t${futureDate()}\tFixture legacy debt covered by baseline.`,
        "",
      ].join("\n"),
    );

    const result = runChecker(root);

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  }));

test("fails stale baseline entries", () =>
  withFixture((root) => {
    mkdirSync(join(root, "scripts", "data"), { recursive: true });
    writeFileSync(
      join(root, "packages", "shared", "src", "styles", "theme.css"),
      ":root { --defined-token: 1rem; }\n",
    );
    writeFileSync(
      join(root, "packages", "client", "src", "index.css"),
      ".ok { margin: var(--defined-token); }\n",
    );
    writeFileSync(
      join(root, "scripts", "data", "css-custom-property-baseline.tsv"),
      [
        "# variable\tpath\tcategory\towner\texpires\tnote",
        `--fixed-token\tpackages/client/src/index.css\tlegacy-runtime\tcodex\t${futureDate()}\tThis baseline entry should now be removed.`,
        "",
      ].join("\n"),
    );

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Stale CSS custom property baseline entries/);
    assert.match(result.stdout, /--fixed-token/);
  }));
