import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ALLOWED_IMPORTS = new Set(["envio", "./shared", "./constants", "./types"]);
const YIELD_CLUSTER_HANDLERS = [
  "hypercerts.ts",
  "yieldSplitter.ts",
  "octantVault.ts",
  "cookieJarFactory.ts",
] as const;

function importSpecifiers(source: string): string[] {
  const fromImports = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].flatMap((match) =>
    match[1] ? [match[1]] : []
  );
  const sideEffectImports = [...source.matchAll(/\bimport\s+["']([^"']+)["']/g)].flatMap((match) =>
    match[1] ? [match[1]] : []
  );
  return [...new Set([...fromImports, ...sideEffectImports])];
}

function disallowedImports(source: string): string[] {
  return importSpecifiers(source).filter((specifier) => !ALLOWED_IMPORTS.has(specifier));
}

describe("yield-cluster handler separation", () => {
  it("detects imports outside the event handler seam", () => {
    assert.deepEqual(
      disallowedImports('import { indexer } from "envio"; import { helper } from "./internal";'),
      ["./internal"]
    );
  });

  for (const handler of YIELD_CLUSTER_HANDLERS) {
    it(`${handler} imports only the public handler seam`, () => {
      const source = readFileSync(
        resolve(import.meta.dirname, `../src/handlers/${handler}`),
        "utf8"
      );
      assert.deepEqual(disallowedImports(source), []);
    });
  }
});
