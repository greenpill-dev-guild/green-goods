import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadSourceUpgradeCompilerJobs } from "./source-upgrade-compiler";
import type { SourceUpgradeArtifacts } from "./source-upgrade-release";

const roots: string[] = [];
const keys = [
  "src/modules/CommitmentPooling.sol:CommitmentPoolingModule",
  "src/modules/SettlementModule.sol:SettlementModule",
];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const out = mkdtempSync(path.join(tmpdir(), "source-compiler-evidence-"));
  roots.push(out);
  mkdirSync(path.join(out, "build-info"));
  const artifacts: SourceUpgradeArtifacts = {};
  const contracts: Record<string, Record<string, unknown>> = {};
  for (const key of keys) {
    const [source, name] = key.split(":");
    const metadata = {
      compiler: { version: "0.8.28+commit.7893614a" },
      settings: {
        compilationTarget: { [source]: name },
        optimizer: { enabled: true, runs: 1 },
        viaIR: true,
        evmVersion: "cancun",
      },
    };
    const rawMetadata = JSON.stringify(metadata);
    const artifact = {
      abi: [],
      metadata,
      rawMetadata,
      bytecode: { object: "0x6000", linkReferences: {} },
      deployedBytecode: { object: "0x6001", linkReferences: {}, immutableReferences: {} },
    };
    artifacts[key] = artifact;
    contracts[source] = {
      [name]: {
        abi: [],
        metadata: rawMetadata,
        evm: {
          bytecode: { object: "6000", linkReferences: {} },
          deployedBytecode: { object: "6001", linkReferences: {}, immutableReferences: {} },
        },
      },
    };
  }
  const sources: Record<string, { id: number; ast: Record<string, unknown> }> = {
    "source.sol": { id: 0, ast: { nodeType: "SourceUnit" } },
  };
  const info = { input: { language: "Solidity", sources: {}, settings: {} }, output: { sources, contracts } };
  const file = path.join(out, "build-info", "current.json");
  const save = () => writeFileSync(file, JSON.stringify(info));
  save();
  return { out, artifacts, info, file, save };
}
describe("source compiler evidence selection", () => {
  it("loads one original compiler job shared by all matching deployment artifacts", () => {
    const f = fixture();
    const jobs = loadSourceUpgradeCompilerJobs(f.out, f.artifacts);
    expect(Object.keys(jobs)).toEqual(keys);
    expect(jobs[keys[0]]).toBe(jobs[keys[1]]);
    expect(jobs[keys[0]].compilerVersion).toBe("0.8.28+commit.7893614a");
    expect(jobs[keys[0]].input).toEqual(f.info.input);
    expect(jobs[keys[0]].output).toEqual(f.info.output);
  });
  it("ignores metadata-only build indexes instead of treating them as compiler output", () => {
    const f = fixture();
    writeFileSync(path.join(f.out, "build-info", "old.json"), JSON.stringify({ id: "old", source_id_to_path: {} }));
    expect(Object.keys(loadSourceUpgradeCompilerJobs(f.out, f.artifacts))).toEqual(keys);
  });
  it("requires full AST evidence for every selected deployment", () => {
    const f = fixture();
    f.info.output.sources = {};
    f.save();
    expect(() => loadSourceUpgradeCompilerJobs(f.out, f.artifacts)).toThrow(/missing.*compiler evidence/i);
  });
  it("rejects foreign original metadata even when the contract name matches", () => {
    const f = fixture();
    f.info.output.contracts[keys[0].split(":")[0]] = {};
    f.save();
    expect(() => loadSourceUpgradeCompilerJobs(f.out, f.artifacts)).toThrow(/missing.*compiler evidence/i);
  });
  it("rejects a candidate with changed creation bytecode", () => {
    const f = fixture();
    f.artifacts[keys[0]].bytecode.object = "0x6002";
    expect(() => loadSourceUpgradeCompilerJobs(f.out, f.artifacts)).toThrow(/missing.*compiler evidence/i);
  });
  it("deduplicates identical job copies but rejects conflicting matching jobs", () => {
    const f = fixture();
    const copy = path.join(f.out, "build-info", "copy.json");
    writeFileSync(copy, readFileSync(f.file));
    expect(Object.keys(loadSourceUpgradeCompilerJobs(f.out, f.artifacts))).toEqual(keys);
    writeFileSync(
      copy,
      JSON.stringify({
        ...f.info,
        input: { ...f.info.input, settings: { outputSelection: { "*": { "": ["ast"] } } } },
      }),
    );
    expect(() => loadSourceUpgradeCompilerJobs(f.out, f.artifacts)).toThrow(/ambiguous.*compiler evidence/i);
  });
  it("refuses symlinked compiler evidence files", () => {
    const f = fixture();
    symlinkSync(f.file, path.join(f.out, "build-info", "link.json"));
    expect(() => loadSourceUpgradeCompilerJobs(f.out, f.artifacts)).toThrow(/symlink/i);
  });
  it("refuses symlinked build-info directories", () => {
    const f = fixture();
    const other = fixture();
    rmSync(path.join(f.out, "build-info"), { recursive: true });
    symlinkSync(path.join(other.out, "build-info"), path.join(f.out, "build-info"));
    expect(() => loadSourceUpgradeCompilerJobs(f.out, f.artifacts)).toThrow(/symlink/i);
  });
});
