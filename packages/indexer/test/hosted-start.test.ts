import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, it } from "mocha";

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

describe("hosted indexer start", () => {
  it("loads the optional root env and launches Envio without Bun or the local wrapper", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    assert.equal(
      packageJson.scripts?.start,
      "node --env-file-if-exists=../../.env ./node_modules/envio/bin.mjs start"
    );
  });
});
