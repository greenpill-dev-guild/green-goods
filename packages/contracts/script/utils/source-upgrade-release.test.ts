import { AbiCoder } from "ethers";
import { describe, expect, it } from "vitest";
import draft from "../../config/source-upgrade-release.json";
import {
  buildSourceUpgradePlan,
  inspectSourceUpgradeManifest,
  type SourceUpgradeArtifacts,
  validateSourceUpgradePlan,
} from "./source-upgrade-release";
import type { VoucherArtifact } from "./voucher-release";

const address = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const commit = "a".repeat(40);
function manifest() {
  return {
    ...structuredClone(draft),
    deployer: address(91),
    nonce: 5,
    authority: { ...draft.authority, nonce: 7 },
    settlement: null,
  };
}
function artifact(key: string, refs: VoucherArtifact["bytecode"]["linkReferences"] = {}): VoucherArtifact {
  const [source, name] = key.split(":");
  return {
    abi: [],
    bytecode: { object: `0x${"00".repeat(60)}`, linkReferences: refs },
    deployedBytecode: { object: `0x${"00".repeat(60)}`, linkReferences: refs },
    metadata: {
      compiler: { version: "0.8.28+commit.fixture" },
      settings: {
        compilationTarget: { [source]: name },
        optimizer: { enabled: true, runs: 1 },
        viaIR: true,
        evmVersion: "cancun",
      },
    },
  };
}
function artifacts(): SourceUpgradeArtifacts {
  return {
    "src/modules/CommitmentPooling.sol:CommitmentPoolingModule": artifact(
      "src/modules/CommitmentPooling.sol:CommitmentPoolingModule",
      { "src/lib/CommitmentPooling/TestLib.sol": { TestLib: [{ start: 1, length: 20 }] } },
    ),
    "src/lib/CommitmentPooling/TestLib.sol:TestLib": artifact("src/lib/CommitmentPooling/TestLib.sol:TestLib"),
  };
}
describe("existing voucher source upgrade preparation", () => {
  it("reports missing freeze inputs without inventing authority or a new proxy", () => {
    const incomplete = { ...manifest(), deployer: null, nonce: null, authority: { ...draft.authority, nonce: null } };
    expect(inspectSourceUpgradeManifest(incomplete).missing).toEqual(["deployer", "nonce", "authority.nonce"]);
    expect(() => buildSourceUpgradePlan(incomplete, artifacts(), commit)).toThrow("Missing");
  });
  it("links dependencies before implementations and separates Safe calls from deployer nonces", () => {
    const p = buildSourceUpgradePlan(manifest(), artifacts(), commit);
    expect(p.deployments.map((t) => t.kind)).toEqual(["library", "implementation"]);
    expect(p.deployments.map((t) => t.nonce)).toEqual([5, 6]);
    expect(p.ownerCalls.map((t) => t.action)).toEqual(["pause", "upgrade"]);
    expect(p.ownerCalls.map((t) => t.safeNonce)).toEqual([7, 8]);
    expect(p.ownerCalls.every((t) => t.to === manifest().pooling.proxy && t.operation === 0)).toBe(true);
    expect(p.endState).toBe("paused-original-owner");
    validateSourceUpgradePlan(p, manifest(), artifacts(), commit);
    p.ownerCalls[1].data += "00";
    expect(() => validateSourceUpgradePlan(p, manifest(), artifacts(), commit)).toThrow("mismatch");
  });
  it("optionally preserves Settlement constructor immutables without creating a new proxy or unpause", () => {
    const m = { ...manifest(), settlement: structuredClone(draft.settlement) };
    const a = artifacts();
    const key = "src/modules/SettlementModule.sol:SettlementModule";
    a[key] = artifact(key);
    const p = buildSourceUpgradePlan(m, a, commit);
    expect(p.deployments.filter((t) => t.kind === "implementation")).toHaveLength(2);
    expect(p.ownerCalls.map((t) => t.target)).toEqual(["pooling", "pooling", "settlement", "settlement"]);
    expect(p.ownerCalls.map((t) => t.safeNonce)).toEqual([7, 8, 9, 10]);
    expect(p.deployments.find((t) => t.key === key)?.data).toBe(
      a[key].bytecode.object +
        AbiCoder.defaultAbiCoder()
          .encode(
            ["address", "uint64", "uint64"],
            [m.settlement.router, m.settlement.sourceSelector, m.settlement.destinationChainId],
          )
          .slice(2),
    );
  });
  it.each(["chainId", "unknown", "deployer", "nonce", "owners", "overlap"])("rejects malformed %s input", (kind) => {
    const m = manifest();
    if (kind === "chainId") m.chainId = 100;
    if (kind === "unknown") Object.assign(m, { broadcast: true });
    if (kind === "deployer") m.deployer = address(0);
    if (kind === "nonce") m.nonce = -1;
    if (kind === "owners") m.authority.owners = [address(1), address(1)];
    if (kind === "overlap") m.deployer = m.authority.address;
    expect(() => inspectSourceUpgradeManifest(m)).toThrow();
  });
  it.each(["missing", "cycle", "offset", "foreign-source", "compiler"])("rejects %s artifact graph", (kind) => {
    const a = artifacts();
    const root = "src/modules/CommitmentPooling.sol:CommitmentPoolingModule";
    const lib = "src/lib/CommitmentPooling/TestLib.sol:TestLib";
    if (kind === "missing") delete a[lib];
    if (kind === "cycle")
      a[lib].bytecode.linkReferences = {
        "src/lib/CommitmentPooling/TestLib.sol": { TestLib: [{ start: 1, length: 20 }] },
      };
    if (kind === "offset")
      a[root].bytecode.linkReferences!["src/lib/CommitmentPooling/TestLib.sol"].TestLib[0].start = 55;
    if (kind === "foreign-source")
      a[root].metadata.settings.compilationTarget = { "src/Other.sol": "CommitmentPoolingModule" };
    if (kind === "compiler") a[root].metadata.compiler.version = "0.8.27";
    expect(() => buildSourceUpgradePlan(manifest(), a, commit)).toThrow();
  });
});
