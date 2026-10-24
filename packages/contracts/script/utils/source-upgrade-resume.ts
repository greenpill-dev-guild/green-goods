import { execFileSync } from "node:child_process";
import path from "node:path";
import { releaseGitEnvironment } from "./release-inputs";

/** Explicitly resume an immutable CREATE plan under newer committed operator tooling. */
export function sourceUpgradePlanRevision(
  root: string,
  manifestPath: string,
  current: string,
  planned: string,
  resume: boolean,
) {
  if (planned === current) return current;
  if (!resume || !/^[a-f0-9]{40}$/.test(planned))
    throw new Error("Source plan requires --resume-plan after a tooling checkpoint");
  const options = { cwd: root, env: releaseGitEnvironment(), encoding: "utf8" as const };
  execFileSync("git", ["merge-base", "--is-ancestor", planned, current], options);
  // Tooling may evolve, but no Solidity, dependency, compiler, network or manifest input may drift.
  execFileSync(
    "git",
    [
      "diff",
      "--exit-code",
      planned,
      current,
      "--",
      "src",
      "lib",
      "foundry.toml",
      "foundry.lock",
      "remappings.txt",
      "package.json",
      "deployments/networks.json",
      path.relative(root, manifestPath),
      "config/source-upgrade-safe-pins.json",
      "../../package.json",
      "../../bun.lock",
      "../../bunfig.toml",
      "../../env.schema",
      "../../scripts/dev/node-cli.js",
      "../../scripts/contracts/check-foundry-version.mjs",
    ],
    options,
  );
  return planned;
}
