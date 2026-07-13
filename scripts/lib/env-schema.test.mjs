import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { assertEnvParity, assertSentryDsnResolvable } from "./env-parity.mjs";
import {
  parseSchemaText,
  readEnvironment,
  requiredKeysForProfile,
  validateRequiredEnvironment,
} from "./env-schema.mjs";

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
  const schemaPath = join(root, ".env.schema");
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
