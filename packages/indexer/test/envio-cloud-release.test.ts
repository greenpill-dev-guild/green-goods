import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "mocha";
import { buildPlan, parseArgs } from "../scripts/envio-cloud-release";

const COMMIT = "6437bb552be104d0c7643cab149065e2eb7ff44b";
const PREVIOUS_COMMIT = "7a9c7eeef96b17c96d5a5f7e15d3e181223bbe6b";
const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../scripts/envio-cloud-release.ts"
);

describe("Envio Cloud release wrapper", () => {
  it("builds separate deploy, promote, and rollback boundaries", () => {
    const options = parseArgs([
      "plan",
      "--org",
      "greenpill-dev-guild",
      "--indexer",
      "green-goods",
      "--commit",
      COMMIT,
      "--previous-production-commit",
      PREVIOUS_COMMIT,
      "--expected-branch",
      "release/commitment-pooling",
    ]);
    const plan = buildPlan(options);

    assert.equal(plan.activationAuthorized, false);
    assert.equal(plan.target.rootDir, "packages/indexer");
    assert.equal(plan.target.configFile, "config.yaml");
    assert.deepEqual(
      plan.transactionBoundaries.map((boundary) => boundary.action),
      ["deploy", "promote", "rollback"]
    );
  });

  it("requires exact commit identity and explicit live target values", () => {
    assert.throws(
      () =>
        parseArgs([
          "deploy",
          "--org",
          "greenpill-dev-guild",
          "--indexer",
          "green-goods",
          "--commit",
          "6437bb5",
          "--previous-production-commit",
          PREVIOUS_COMMIT,
          "--expected-branch",
          "release/commitment-pooling",
        ]),
      /exact lowercase 40-character SHA/
    );
    assert.throws(
      () =>
        parseArgs([
          "deploy",
          "--org",
          "greenpill-dev-guild",
          "--indexer",
          "green-goods",
          "--commit",
          COMMIT,
          "--previous-production-commit",
          PREVIOUS_COMMIT,
        ]),
      /Missing required --expected-branch/
    );
    assert.throws(
      () =>
        parseArgs([
          "deploy",
          "--org",
          "greenpill-dev-guild",
          "--indexer",
          "green-goods",
          "--commit",
          COMMIT,
          "--previous-production-commit",
          PREVIOUS_COMMIT,
          "--expected-branch",
          "release/commitment-pooling",
          "--yes",
        ]),
      /Unknown option: --yes/
    );
  });

  it("prints an action-specific Phase B authorization value", () => {
    const options = parseArgs([
      "rollback",
      "--org",
      "greenpill-dev-guild",
      "--indexer",
      "green-goods",
      "--commit",
      COMMIT,
      "--previous-production-commit",
      PREVIOUS_COMMIT,
      "--expected-branch",
      "release/commitment-pooling",
    ]);
    const plan = buildPlan(options);

    assert.equal(
      plan.requiredAuthorization,
      `envio:rollback:greenpill-dev-guild/green-goods@${PREVIOUS_COMMIT}`
    );
  });

  it("fails closed at the real deploy entrypoint before invoking an unavailable Cloud CLI", () => {
    const result = spawnSync(
      "bun",
      [
        scriptPath,
        "deploy",
        "--org",
        "greenpill-dev-guild",
        "--indexer",
        "green-goods",
        "--commit",
        COMMIT,
        "--previous-production-commit",
        PREVIOUS_COMMIT,
        "--expected-branch",
        "release/commitment-pooling",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, ENVIO_CLOUD_BIN: "/definitely/not/envio-cloud" },
      }
    );

    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, /Missing exact Phase B authorization/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /envio-cloud is unavailable/);
  });
});
