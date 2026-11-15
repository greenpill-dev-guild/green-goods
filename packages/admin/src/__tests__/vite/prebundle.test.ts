// TEST-QUALITY: allow-small-test-file - one config invariant: Shared's bare imports stay pre-bundled.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));
const sharedSource = fileURLToPath(new URL("../../../../shared/src/", import.meta.url));
const BARE_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\sfrom\s+)?["']([^"'.][^"']*)["']|import\(\s*["']([^"'.][^"']*)["']\s*\)/g;

function sharedRuntimeImports(directory: string, found = new Set<string>()): Set<string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sharedRuntimeImports(path, found);
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec|stories|d)\.tsx?$/.test(entry.name)) {
      for (const match of readFileSync(path, "utf8").matchAll(BARE_IMPORT)) {
        const specifier = match[2] ?? match[3];
        if (match[1] || !specifier || /^(@\/|@green-goods\/|node:|virtual:)/.test(specifier))
          continue;
        found.add(specifier);
      }
    }
  }
  return found;
}

describe("dependency pre-bundling", () => {
  it("names every bare runtime import of @green-goods/shared, which the startup scan skips", () => {
    const config = readFileSync(join(packageRoot, "vite.config.ts"), "utf8");
    const list = config.slice(config.indexOf("include: [", config.indexOf("optimizeDeps")));
    const included = new Set(
      [...list.slice(0, list.indexOf("],")).matchAll(/"([^"]+)"/g)].map((match) =>
        match[1].replace(/^@green-goods\/shared > /, "")
      )
    );
    const missing = [...sharedRuntimeImports(sharedSource)].filter(
      (specifier) => !included.has(specifier)
    );
    expect(missing.sort()).toEqual([]);
  });
});
