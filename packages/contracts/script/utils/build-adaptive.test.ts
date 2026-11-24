/** @direct-test-command ./build-adaptive.ts */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "build-adaptive.ts");

function runBuild(
  options: {
    mode?: "fast" | "auto" | "full";
    changed?: string;
    profile?: string;
    quiet?: boolean;
    exitCode?: number;
  } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "green-goods-adaptive-build-"));
  const bin = join(root, "bin");
  const argvFile = join(root, "argv");
  const profileFile = join(root, "profile");
  mkdirSync(bin);
  writeFileSync(join(bin, "git"), '#!/usr/bin/env bash\nprintf "%s" "$GG_ADAPTIVE_CHANGED"\n', { mode: 0o755 });
  writeFileSync(
    join(bin, "forge"),
    [
      "#!/usr/bin/env bash",
      'printf "%s\\n" "$@" > "$GG_ADAPTIVE_ARGV_FILE"',
      'printf "%s" "$FOUNDRY_PROFILE" > "$GG_ADAPTIVE_PROFILE_FILE"',
      'if [[ "$GG_ADAPTIVE_EXIT_CODE" != "0" ]]; then printf "%s\\n" "fixture-adaptive-compiler-failure" >&2; fi',
      'exit "$GG_ADAPTIVE_EXIT_CODE"',
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    GG_CONTRACTS_BUILD_MODE: options.mode ?? "auto",
    GG_CONTRACTS_BUILD_QUIET: options.quiet === false ? "0" : "1",
    GG_ADAPTIVE_CHANGED: options.changed ?? "",
    GG_ADAPTIVE_ARGV_FILE: argvFile,
    GG_ADAPTIVE_PROFILE_FILE: profileFile,
    GG_ADAPTIVE_EXIT_CODE: String(options.exitCode ?? 0),
  };
  delete env.FOUNDRY_PROFILE;
  if (options.profile) env.FOUNDRY_PROFILE = options.profile;
  try {
    const result = spawnSync("bun", ["--no-env-file", script], { encoding: "utf8", env });
    if (result.error) throw result.error;
    return {
      ...result,
      argv: readFileSync(argvFile, "utf8").trimEnd().split("\n"),
      profile: readFileSync(profileFile, "utf8"),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("adaptive build process boundary", () => {
  it("keeps fast src positional after variadic skip filters", () => {
    const result = runBuild({ mode: "fast" });
    expect(result.status).toBe(0);
    expect(result.argv).toEqual(["build", "-q", "--skip", "test", "--skip", "script", "--", "src"]);
    expect(result.profile).toBe("");
  });

  it("keeps an auto-selected source positional without adding changed tests", () => {
    const result = runBuild({
      changed: " M packages/contracts/src/modules/One.sol\n M packages/contracts/test/One.t.sol\n",
    });
    expect(result.status).toBe(0);
    expect(result.argv).toEqual(["build", "-q", "--skip", "test", "--skip", "script", "--", "src/modules/One.sol"]);
  });

  it("keeps shared-source broadening and changed script inclusion after the boundary", () => {
    const result = runBuild({
      changed: " M packages/contracts/src/interfaces/Shared.sol\n M packages/contracts/script/Fixture.s.sol\n",
    });
    expect(result.status).toBe(0);
    expect(result.argv).toEqual(["build", "-q", "--skip", "test", "--", "script/Fixture.s.sol", "src"]);
  });

  it("preserves full-project compilation and the default test profile", () => {
    const result = runBuild({ mode: "full" });
    expect(result.status).toBe(0);
    expect(result.argv).toEqual(["build", "-q"]);
    expect(result.profile).toBe("test");
  });

  it("preserves an explicit profile and nonquiet output", () => {
    const result = runBuild({ mode: "full", profile: "production", quiet: false });
    expect(result.status).toBe(0);
    expect(result.argv).toEqual(["build"]);
    expect(result.profile).toBe("production");
  });

  it("propagates a compiler failure and its diagnostic", () => {
    const result = runBuild({ mode: "fast", exitCode: 42 });
    expect(result.status).toBe(42);
    expect(result.stderr).toContain("fixture-adaptive-compiler-failure");
  });
});
