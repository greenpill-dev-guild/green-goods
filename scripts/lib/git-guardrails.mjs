import { spawnSync } from "node:child_process";

export function runGit(repoRoot, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    // Large planning/spec PRs can legitimately exceed Node's 1 MiB child-process default.
    // The diff-aware guards must inspect the complete patch instead of failing with an empty
    // stderr after spawnSync terminates on ENOBUFS.
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error && !allowFailure) {
    throw new Error(`git ${args.join(" ")} failed: ${result.error.message}`);
  }
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result;
}

export function parseBaseArgs(argv) {
  let base;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--base") {
      if (!argv[index + 1]) throw new Error("--base requires a Git ref");
      base = argv[++index];
    } else {
      throw new Error(`unknown argument: ${argv[index]}`);
    }
  }
  return { base };
}

function resolves(repoRoot, candidate) {
  return (
    runGit(repoRoot, ["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`], {
      allowFailure: true,
    }).status === 0
  );
}

export function resolveGitBase({
  repoRoot,
  explicitBase,
  environmentVariables = [],
  fallback = "origin/develop",
}) {
  if (explicitBase) {
    if (!resolves(repoRoot, explicitBase)) {
      throw new Error(`base ref does not resolve to a commit: ${explicitBase}`);
    }
    return explicitBase;
  }

  for (const variable of environmentVariables) {
    const candidate = process.env[variable];
    if (candidate && resolves(repoRoot, candidate)) return candidate;
  }
  return fallback && resolves(repoRoot, fallback) ? fallback : undefined;
}
