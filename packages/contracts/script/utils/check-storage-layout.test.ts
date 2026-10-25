import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// TEST-QUALITY: allow-small-test-file - isolated shell-process regressions protect source selection and compiler failure visibility.
const script = resolve(dirname(fileURLToPath(import.meta.url)), "../check-storage-layout.sh");

function failedBuild(args: string[] = []) {
  const root = mkdtempSync(join(tmpdir(), "green-goods-storage-layout-"));
  const scripts = join(root, "script");
  const bin = join(root, "bin");
  const argvFile = join(root, "forge-argv");
  mkdirSync(scripts);
  mkdirSync(bin);
  copyFileSync(script, join(scripts, "check-storage-layout.sh"));
  writeFileSync(
    join(bin, "forge"),
    '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$FORGE_ARGV_FILE"\nprintf "%s\\n" "fixture-storage-layout-build-failure" >&2\nexit 42\n',
    { mode: 0o755 },
  );
  try {
    const result = spawnSync("bash", [join(scripts, "check-storage-layout.sh"), ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FORGE_ARGV_FILE: argvFile },
    });
    if (result.error) throw result.error;
    return { ...result, argv: readFileSync(argvFile, "utf8").trimEnd().split("\n") };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("storage validator build boundary", () => {
  it("keeps the full source bucket positional after variadic skip filters", () => {
    const result = failedBuild();
    const separator = result.argv.indexOf("--");
    expect(separator).toBeGreaterThan(-1);
    expect(result.argv.slice(separator + 1)).toEqual(["src"]);
    expect(result.argv.slice(0, separator)).toEqual([
      "build",
      "--quiet",
      "--extra-output",
      "storageLayout",
      "--force",
      "--skip",
      "test",
      "--skip",
      "script",
    ]);
  });

  it("keeps a selected protected contract positional after variadic skip filters", () => {
    const result = failedBuild(["--contract", "HatsModule"]);
    const separator = result.argv.indexOf("--");
    expect(separator).toBeGreaterThan(-1);
    expect(result.argv.slice(separator + 1)).toEqual(["src/modules/Hats.sol"]);
    expect(result.argv).toContain("--force");
    expect(result.argv).toContain("storageLayout");
  });

  it("fails closed while retaining the compiler error for diagnosis", () => {
    const result = failedBuild();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Compilation failed. Fix build errors first.");
    expect(result.stderr).toContain("fixture-storage-layout-build-failure");
  });
});
