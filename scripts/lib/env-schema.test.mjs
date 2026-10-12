import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertEnvParity,
  assertSentryDsnResolvable,
  dropVercelFrameworkVariables,
} from "./env-parity.mjs";
import {
  findSyncProblems,
  parseSchema,
  parseSchemaText,
  readEnvironment,
  requiredKeysForProfile,
  secretSyncReadiness,
  validateRequiredEnvironment,
} from "./env-schema.mjs";
import { createBaselineEnv } from "./setup-env.mjs";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const checkedInSchemaPath = join(projectRoot, "env.schema");

/**
 * A throwaway project root holding copies of the real env scripts, so they resolve a fixture
 * env.schema and .env instead of this checkout's. Its `op` stands in for 1Password: it copies
 * the inject input to the output, or fails after a partial write when OP_STUB_FAIL is set.
 */
function envScriptSandbox(t, schemaText) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "env-scripts-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of ["scripts/dev/env-sync.js", "scripts/dev/env-check.js", "scripts/lib/env-schema.mjs"]) {
    cpSync(join(projectRoot, file), join(root, file));
  }
  writeFileSync(join(root, "env.schema"), schemaText);
  mkdirSync(join(root, "bin"));
  writeFileSync(
    join(root, "bin/op"),
    [
      "#!/bin/sh",
      "# Called as: op inject -i <input> -o <output> --force",
      'echo "$3" > "$OP_STUB_SAW"',
      'if [ -n "$OP_STUB_FAIL" ]; then echo half-written > "$5"; exit 1; fi',
      'cp "$3" "$5"',
      "",
    ].join("\n")
  );
  chmodSync(join(root, "bin/op"), 0o755);

  const run = (script, args = [], env = {}) =>
    spawnSync(process.execPath, [join(root, "scripts/dev", script), ...args], {
      encoding: "utf8",
      env: {
        PATH: `${join(root, "bin")}${delimiter}${process.env.PATH}`,
        OP_STUB_SAW: join(root, "op-saw"),
        ...env,
      },
    });
  return { root, run };
}

const schema = [
  "# @required-in dev, production-client",
  "APP_ENV=",
  "VITE_API_BASE_URL= # @required-in sourcemaps-client",
  "OPTIONAL_VALUE= # @optional",
  "DEFAULTED_VALUE=present",
  "PLAIN_VALUE=",
  "",
].join("\n");

test("selects required schema keys from profile annotations", () => {
  const entries = parseSchemaText(schema);

  assert.deepEqual(requiredKeysForProfile(entries, "dev"), ["APP_ENV"]);
  assert.deepEqual(requiredKeysForProfile(entries, "production-client"), ["APP_ENV"]);
  assert.deepEqual(requiredKeysForProfile(entries, "sourcemaps-client"), ["VITE_API_BASE_URL"]);
  assert.deepEqual(requiredKeysForProfile(entries, "production-admin"), []);
});

test("process env source bypasses a missing env file", () => {
  const env = readEnvironment({
    source: "process",
    envFilePath: join(process.cwd(), "does-not-exist.env"),
    processEnv: { REQUIRED_FROM_CI: "present" },
  });

  assert.deepEqual(env, { REQUIRED_FROM_CI: "present" });
});

test("file env source reports a missing file", () => {
  const env = readEnvironment({
    source: "file",
    envFilePath: join(process.cwd(), "does-not-exist.env"),
    processEnv: { REQUIRED_FROM_CI: "present" },
  });

  assert.equal(env, null);
});

test("reports missing and empty values from an injected process environment", () => {
  assert.deepEqual(
    validateRequiredEnvironment(["PRESENT", "EMPTY", "MISSING"], {
      PRESENT: "value",
      EMPTY: "   ",
    }),
    { missing: ["MISSING"], empty: ["EMPTY"] },
  );
});

test("reports each thing that would break a sync or put a wrong value in .env", () => {
  const cases = [
    [
      [
        "PLAIN=value",
        "EMPTY=",
        "ANNOTATED= # @required-in dev",
        "SECRET=op://Vault/Item/field",
        'SPACED="op://Team Vault/An Item/field"',
      ].join("\n"),
      [],
    ],
    ["# e.g. op://Vault/Item/field\nKEY=", [/^line 1: a comment holds a 1Password reference/]],
    ["KEY= # see op://Vault/Item/field", [/^line 1: KEY has a 1Password reference in its comment/]],
    ["PINATA_JWT_OP_REF=", [/PINATA_JWT_OP_REF is a reference companion nothing resolves/]],
    ["KEY=if($KEY_REF, op($KEY_REF), '')", [/KEY holds a \$VAR or function expression/]],
    ["ALIAS=$OTHER_KEY", [/ALIAS holds a \$VAR or function expression/]],
    ["KEY=op://Vault/Item", [/KEY is not a whole 1Password reference/]],
    ["KEY=https://example.test/?next=op://Vault/Item/field", [/KEY is not a whole 1Password reference/]],
    ["KEY=one\nKEY=two", [/^line 2: KEY is declared twice/]],
  ];

  for (const [text, expected] of cases) {
    const problems = findSyncProblems(text);
    assert.equal(problems.length, expected.length, `${JSON.stringify(text)} -> ${problems.join(" | ")}`);
    expected.forEach((pattern, index) => assert.match(problems[index], pattern));
  }
});

test("the checked-in env.schema can be synced as written", () => {
  assert.deepEqual(findSyncProblems(readFileSync(checkedInSchemaPath, "utf8")), []);
});

test("a fresh isolated setup satisfies the checked-in schema's dev profile", (t) => {
  const root = mkdtempSync(join(tmpdir(), "env-baseline-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const required = requiredKeysForProfile(parseSchema(checkedInSchemaPath), "dev");

  createBaselineEnv(root, "isolated");
  const baseline = readEnvironment({ source: "file", envFilePath: join(root, ".env") });

  assert.ok(required.length > 0, "env.schema marks no key @required-in dev");
  assert.deepEqual(validateRequiredEnvironment(required, baseline), { missing: [], empty: [] });
});

test("env:check defaults to the dev profile and refuses a profile nothing is annotated for", (t) => {
  const { root, run } = envScriptSandbox(t, "# @required-in dev\nNEEDED=\n# @required-in production\nLATER=\n");
  const check = (args, env) => run("env-check.js", ["--env-source", "process", ...args], env);

  assert.equal(check([], { NEEDED: "set" }).status, 0);

  const incomplete = check([], { LATER: "set" });
  assert.equal(incomplete.status, 1);
  assert.match(incomplete.stderr, /Missing keys \(1\):\s+- NEEDED/);

  // A mistyped profile used to pass with nothing checked.
  const mistyped = check(["--profile", "prodution"], { NEEDED: "set", LATER: "set" });
  assert.equal(mistyped.status, 1);
  assert.match(mistyped.stderr, /marks no key `@required-in prodution`/);

  // The schema is public: for a missing secret the remedy is a reference or the local file.
  writeFileSync(join(root, ".env"), "LATER=set\n");
  const fromFile = run("env-check.js");
  assert.equal(fromFile.status, 1);
  assert.match(fromFile.stderr, /1Password reference in env\.schema, or set it in your own \.env/);
  assert.match(fromFile.stderr, /Never write a secret's value into env\.schema/);
});

test("a missing 1Password CLI fails readiness only when there is no .env to use", () => {
  const verdict = (state) => secretSyncReadiness({ referenceCount: 18, hasOpCli: false, hasEnvFile: false, ...state });

  // A contributor on the isolated baseline has a .env and never runs the sync.
  assert.equal(verdict({ hasEnvFile: true }).level, "info");
  assert.match(verdict({ hasEnvFile: true }).detail, /Only `bun run env:sync` needs it/);

  const blocked = verdict({});
  assert.equal(blocked.level, "fail");
  assert.match(blocked.fix, /bun run env:sync/);
  assert.match(blocked.fix, /npm run setup -- --profile isolated/);

  assert.equal(verdict({ hasOpCli: true }).level, "info");
  assert.equal(verdict({ referenceCount: 0 }).level, "info");
});

test("env:sync injects from env.schema, keeps a backup, and restores .env when the inject fails", (t) => {
  const schemaText = "PLAIN=value\nSECRET=op://Vault/Item/field\n";
  const { root, run } = envScriptSandbox(t, schemaText);
  const envPath = join(root, ".env");
  writeFileSync(envPath, "PERSONAL=keep-me\n");

  const synced = run("env-sync.js");
  assert.equal(synced.status, 0, synced.stderr);
  assert.equal(readFileSync(join(root, "op-saw"), "utf8").trim(), join(root, "env.schema"));
  assert.equal(readFileSync(envPath, "utf8"), schemaText);
  assert.equal(readFileSync(join(root, ".env.bak"), "utf8"), "PERSONAL=keep-me\n");

  writeFileSync(envPath, "PERSONAL=keep-me\n");
  const failed = run("env-sync.js", [], { OP_STUB_FAIL: "1" });
  assert.equal(failed.status, 1);
  assert.equal(readFileSync(envPath, "utf8"), "PERSONAL=keep-me\n");
});

test("env:sync refuses a schema it cannot inject before it touches .env or calls op", (t) => {
  const { root, run } = envScriptSandbox(t, "# example: op://Vault/Item/field\nKEY=\n");
  const envPath = join(root, ".env");
  writeFileSync(envPath, "PERSONAL=keep-me\n");

  const refused = run("env-sync.js");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /env\.schema line 1: a comment holds a 1Password reference/);
  assert.equal(existsSync(join(root, "op-saw")), false);
  assert.equal(existsSync(join(root, ".env.bak")), false);
  assert.equal(readFileSync(envPath, "utf8"), "PERSONAL=keep-me\n");
});

test("rejects an injected production Vercel environment without a Sentry DSN", () => {
  assert.throws(
    () =>
      assertSentryDsnResolvable({
        app: "client",
        sentryDsn: undefined,
        env: { VERCEL: "1", VERCEL_ENV: "production" },
        logger: { warn() {} },
      }),
    /\[env-parity\].*Refusing to ship a production build without it/,
  );
});

test("enforces annotated keys for production and only warns for preview", () => {
  const root = mkdtempSync(join(tmpdir(), "env-parity-"));
  const schemaPath = join(root, "env.schema");
  writeFileSync(schemaPath, "VITE_REQUIRED= # @required-in production-client\n");

  try {
    assert.throws(
      () =>
        assertEnvParity({
          app: "client",
          env: { VERCEL: "1", VERCEL_ENV: "production" },
          schemaPath,
          logger: { warn() {} },
        }),
      /\[env-parity\].*VITE_REQUIRED/,
    );

    const warnings = [];
    const result = assertEnvParity({
      app: "client",
      env: { VERCEL: "1", VERCEL_ENV: "preview" },
      schemaPath,
      logger: { warn: (message) => warnings.push(message) },
    });

    assert.deepEqual(result, { checked: true, missing: ["VITE_REQUIRED"], empty: [] });
    assert.match(warnings[0], /Staging should mirror production/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects missing or empty authentication keys on beta but allows local builds", () => {
  const root = mkdtempSync(join(tmpdir(), "env-auth-parity-"));
  const schemaPath = join(root, "env.schema");
  const keys = ["VITE_PIMLICO_API_KEY", "VITE_WALLETCONNECT_PROJECT_ID"];
  writeFileSync(
    schemaPath,
    keys.map((key) => `${key}= # @required-in production-admin`).join("\n")
  );
  try {
    for (const key of keys) {
      for (const value of [undefined, ""]) {
        const authEnv = Object.fromEntries(keys.map((name) => [name, "configured"]));
        authEnv[key] = value;
        assert.throws(
          () => assertEnvParity({
            app: "admin",
            env: { ...authEnv, VERCEL: "1", VERCEL_ENV: "preview" },
            schemaPath,
          }),
          new RegExp(`authentication keys are incomplete \\(${key}\\)`)
        );
      }
    }
    assert.doesNotThrow(() => assertEnvParity({ app: "admin", env: {}, schemaPath }));
    assert.doesNotThrow(() => assertEnvParity({
      app: "admin",
      env: {
        VERCEL: "1", VERCEL_ENV: "preview",
        VITE_PIMLICO_API_KEY: "configured", VITE_WALLETCONNECT_PROJECT_ID: "configured",
      },
      schemaPath,
    }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails soft for an unreadable schema outside production Vercel", () => {
  const warnings = [];

  const result = assertEnvParity({
    app: "client",
    env: {},
    schemaPath: process.cwd(),
    logger: { warn: (message) => warnings.push(message) },
  });

  assert.deepEqual(result, { checked: false, missing: [], empty: [] });
  assert.match(warnings[0], /Unable to read .*skipping client schema validation/);
});

test("rejects an unreadable schema in a production Vercel build", () => {
  assert.throws(
    () =>
      assertEnvParity({
        app: "client",
        env: { VERCEL: "1", VERCEL_ENV: "production" },
        schemaPath: process.cwd(),
        logger: { warn() {} },
      }),
    /Refusing to ship a production build without schema validation/
  );
});

test("drops Vercel's VITE_-prefixed copies and keeps what the build and the app read", () => {
  const env = {
    VITE_VERCEL_GIT_COMMIT_MESSAGE: "fix: a commit message nobody in the browser needs",
    VITE_VERCEL_TARGET_ENV: "staging",
    VERCEL_GIT_COMMIT_SHA: "0123abc",
    VERCEL_TARGET_ENV: "staging",
    VITE_CHAIN_ID: "11155111",
  };

  dropVercelFrameworkVariables(env);

  assert.deepEqual(env, {
    VERCEL_GIT_COMMIT_SHA: "0123abc",
    VERCEL_TARGET_ENV: "staging",
    VITE_CHAIN_ID: "11155111",
  });
});
