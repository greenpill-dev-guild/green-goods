import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { SourceUpgradeArtifacts } from "./source-upgrade-release";
import type { SourceUpgradeCompilerJob, SourceUpgradeCompilerJobs } from "./source-upgrade-runtime";
import { voucherDigest } from "./voucher-release";

function directory(input: string) {
  const stat = lstatSync(input);
  if (stat.isSymbolicLink()) throw new Error("Source compiler evidence cannot follow a symlink");
  if (!stat.isDirectory()) throw new Error("Source compiler evidence requires a directory");
}
type CompilerOutput = SourceUpgradeCompilerJob["output"]["contracts"][string][string];
function matches(output: CompilerOutput | undefined, artifact: SourceUpgradeArtifacts[string]): boolean {
  const original = (artifact as unknown as { rawMetadata?: unknown }).rawMetadata;
  if (!output || typeof original !== "string" || output.metadata !== original) return false;
  return (["bytecode", "deployedBytecode"] as const).every((part) => {
    const compiled = output.evm?.[part],
      retained = artifact[part];
    return (
      compiled &&
      typeof compiled.object === "string" &&
      compiled.object.replace(/^0x/, "") === retained.object.replace(/^0x/, "") &&
      isDeepStrictEqual(compiled.linkReferences ?? {}, retained.linkReferences ?? {}) &&
      (part !== "deployedBytecode" ||
        isDeepStrictEqual(
          (compiled as typeof artifact.deployedBytecode).immutableReferences ?? {},
          artifact.deployedBytecode.immutableReferences ?? {},
        ))
    );
  });
}

/** Select original full compiler jobs; semantic/AST provenance is checked by runtime materialization. */
export function loadSourceUpgradeCompilerJobs(
  out: string,
  artifacts: SourceUpgradeArtifacts,
): SourceUpgradeCompilerJobs {
  directory(out);
  const infoDirectory = path.join(out, "build-info");
  directory(infoDirectory);
  const infos: Array<{
    input: SourceUpgradeCompilerJob["input"];
    output: SourceUpgradeCompilerJob["output"];
    job?: SourceUpgradeCompilerJob;
  }> = [];
  for (const file of readdirSync(infoDirectory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!file.name.endsWith(".json")) continue;
    if (file.isSymbolicLink()) throw new Error("Source compiler evidence cannot follow a symlink");
    if (!file.isFile()) throw new Error("Source compiler evidence must be a regular file");
    const value = JSON.parse(readFileSync(path.join(infoDirectory, file.name), "utf8"));
    // Foundry also writes small source-id indexes. They cannot establish an AST/compiler job.
    if (!value?.input || !value?.output) continue;
    const sources = value.output.sources;
    if (
      value.input.language !== "Solidity" ||
      !sources ||
      !Object.keys(sources).length ||
      !Object.values(sources).every((source) => source && typeof source === "object" && "ast" in source)
    )
      continue;
    infos.push(value);
  }
  const jobs: SourceUpgradeCompilerJobs = {};
  for (const [key, artifact] of Object.entries(artifacts)) {
    const [source, contract] = key.split(":");
    const candidates = new Map<string, SourceUpgradeCompilerJob>();
    for (const info of infos) {
      const output = info.output.contracts?.[source]?.[contract];
      if (!matches(output, artifact)) continue;
      const compilerVersion = JSON.parse(output.metadata).compiler?.version;
      if (typeof compilerVersion !== "string") throw new Error("Invalid source compiler evidence version");
      info.job ??= { compilerVersion, input: info.input, output: info.output };
      if (info.job.compilerVersion !== compilerVersion) throw new Error("Mixed source compiler evidence versions");
      candidates.set(voucherDigest(info.job), info.job);
    }
    if (!candidates.size)
      throw new Error(`Missing full source compiler evidence for ${key}; rebuild with AST and build info`);
    if (candidates.size !== 1) throw new Error(`Ambiguous source compiler evidence for ${key}`);
    jobs[key] = candidates.values().next().value!;
  }
  return jobs;
}
