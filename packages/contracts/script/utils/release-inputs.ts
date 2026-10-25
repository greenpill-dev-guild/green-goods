import { execFileSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { CONTRACTS_ROOT } from "./paths";

export function releaseJsonPath(directory: string, input: string): string {
  const resolved = path.resolve(CONTRACTS_ROOT, input),
    relative = path.relative(directory, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || path.extname(resolved) !== ".json")
    throw new Error("Release input/output path must stay inside its owned JSON directory");
  for (let current = resolved; current !== path.dirname(current); current = path.dirname(current)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink())
      throw new Error("Release JSON paths cannot follow symlinks");
    if (current === CONTRACTS_ROOT) break;
  }
  return resolved;
}
export function releaseGitEnvironment() {
  const env = { ...process.env };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"]) delete env[key];
  return env;
}
export function assertReleaseSourcesCommitted(root: string, manifestPath: string): void {
  const sourcePaths = [
    "src",
    "lib",
    "script",
    "foundry.toml",
    "foundry.lock",
    "remappings.txt",
    "package.json",
    "deployments/networks.json",
    path.relative(root, manifestPath),
    "../../package.json",
    "../../bun.lock",
    "../../bunfig.toml",
    "../../env.schema",
    "../../scripts/dev/node-cli.js",
    "../../scripts/contracts/check-foundry-version.mjs",
  ];
  const env = releaseGitEnvironment();
  if (
    execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all", "--", ...sourcePaths], {
      cwd: root,
      env,
      encoding: "utf8",
    }).trim()
  )
    throw new Error("Release plans require committed, unchanged deployment inputs");
}

/** Capture before reading inputs/compiling, then compare again before producing a plan. */
export function releaseRevision(root: string, manifestPath: string): string {
  assertReleaseSourcesCommitted(root, manifestPath);
  const options = { cwd: root, env: releaseGitEnvironment(), encoding: "utf8" as const };
  execFileSync("git", ["ls-files", "--error-unmatch", "--", path.relative(root, manifestPath)], options);
  return execFileSync("git", ["rev-parse", "HEAD"], options).trim();
}
