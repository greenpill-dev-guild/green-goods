import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  AbiCoder,
  Interface,
  type JsonRpcProvider,
  keccak256,
  type TransactionRequest,
  toBeHex,
  toQuantity,
  ZeroAddress,
} from "ethers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import draft from "../../config/source-upgrade-release.json";
import { minedIsolatedReceipt } from "./isolated-fork";
import { createIsolatedSeed } from "./isolated-fork.fixtures";
import { CONTRACTS_ROOT, getFoundryOutDir } from "./paths";
import { loadSourceUpgradeCompilerJobs } from "./source-upgrade-compiler";
import {
  buildSourceUpgradePlan,
  loadSourceUpgradeArtifacts,
  SOURCE_IMPLEMENTATION_SLOT,
  SOURCE_UPGRADE_TARGETS,
  type SourceUpgradeManifest,
} from "./source-upgrade-release";
import type { SourceUpgradeCompilerJobs } from "./source-upgrade-runtime";
import { simulateSourceUpgradePlan, snapshotSourceUpgradeState } from "./source-upgrade-simulation";
import { voucherDigest } from "./voucher-release";

const address = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const commit = "b".repeat(40);
let seed: Awaited<ReturnType<typeof createIsolatedSeed>>;
let m: SourceUpgradeManifest;
let a: ReturnType<typeof loadSourceUpgradeArtifacts>;
let jobs: SourceUpgradeCompilerJobs;
/** Selector dispatch for public Safe readback only; execution is explicitly impersonated on owned forks. */
function safeFixture() {
  const i = new Interface([
    "function getOwners() view returns(address[])",
    "function getThreshold() view returns(uint256)",
    "function nonce() view returns(uint256)",
    "function getModulesPaginated(address,uint256) view returns(address[],address)",
  ]);
  const rows = [...(["getOwners", "getThreshold", "nonce", "getModulesPaginated"] as const)].map((name) => ({
    selector: i.getFunction(name)!.selector.slice(2),
    result: i.encodeFunctionResult(
      name,
      name === "getOwners"
        ? [draft.authority.owners]
        : name === "getThreshold"
          ? [2]
          : name === "nonce"
            ? [0]
            : [[], "0x0000000000000000000000000000000000000001"],
    ),
  }));
  let pc = rows.length * 16 + 5;
  let dataOffset = pc + rows.length * 16;
  const jumps: string[] = [];
  const bodies: string[] = [];
  for (const r of rows) {
    jumps.push(`60003560e01c63${r.selector}1461${pc.toString(16).padStart(4, "0")}57`);
    const n = (r.result.length - 2) / 2;
    bodies.push(
      `5b61${n.toString(16).padStart(4, "0")}61${dataOffset.toString(16).padStart(4, "0")}60003961${n.toString(16).padStart(4, "0")}6000f3`,
    );
    pc += 16;
    dataOffset += n;
  }
  return `0x${jumps.join("")}60006000fd${bodies.join("")}${rows.map((r) => r.result.slice(2)).join("")}`;
}
async function send(client: JsonRpcProvider, from: string, to: string | null, data: string) {
  const hash = await client.send("eth_sendTransaction", [
    { from, ...(to ? { to } : {}), data, gas: toQuantity(29_000_000) },
  ]);
  const receipt = await minedIsolatedReceipt(client, hash);
  if (receipt.status !== 1) throw new Error("Seed transaction failed");
  return receipt;
}
describe("production existing source upgrade on process-owned forks", () => {
  beforeAll(async () => {
    const buildInfoPath = process.env.SOURCE_UPGRADE_COMPILER_BUILD_INFO;
    const artifactOut = buildInfoPath ? path.dirname(path.dirname(buildInfoPath)) : getFoundryOutDir("production");
    m = {
      ...structuredClone(draft),
      chainId: 42161,
      schemaVersion: 1,
      deployer: address(91),
      nonce: 0,
      authority: { ...draft.authority, nonce: 0 },
    };
    const loadEvidence = () => {
      a = loadSourceUpgradeArtifacts(artifactOut, m);
      jobs = loadSourceUpgradeCompilerJobs(artifactOut, a);
    };
    try {
      loadEvidence();
    } catch (error) {
      const missing =
        error instanceof Error &&
        (error.message.startsWith("Missing full source compiler evidence") ||
          (error as NodeJS.ErrnoException).code === "ENOENT");
      if (buildInfoPath || !missing) throw error;
      const built = spawnSync(
        "bun",
        [
          "--no-env-file",
          "run",
          "build",
          "--mode",
          "target",
          "--",
          ...Object.values(SOURCE_UPGRADE_TARGETS).map((key) => key.split(":")[0]),
        ],
        {
          cwd: CONTRACTS_ROOT,
          env: { ...process.env, FOUNDRY_PROFILE: "production", FOUNDRY_BUILD_INFO: "true", FOUNDRY_AST: "true" },
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
        },
      );
      if (built.error || built.status !== 0)
        throw new Error(
          `Production compiler evidence build failed: ${built.error?.message ?? built.stderr ?? built.stdout}`,
        );
      loadEvidence();
    }
    seed = await createIsolatedSeed(42161);
    await seed.client.send("anvil_impersonateAccount", [m.deployer]);
    await seed.client.send("anvil_setBalance", [m.deployer, toQuantity(100n * 10n ** 18n)]);
    await seed.client.send("anvil_setCode", [m.authority.address, safeFixture()]);
    await seed.client.send("anvil_impersonateAccount", [m.authority.address]);
    await seed.client.send("anvil_setBalance", [m.authority.address, toQuantity(100n * 10n ** 18n)]);
    const initial = buildSourceUpgradePlan(m, a, commit);
    for (const tx of initial.deployments) await send(seed.client, m.deployer!, null, tx.data);
    const implementation = initial.deployments.find((t) => t.kind === "implementation")!.address;
    m.pooling = {
      proxy: address(71),
      implementation,
      implementationCodeHash: keccak256(await seed.client.getCode(implementation)),
    };
    const proxy = JSON.parse(
      readFileSync(path.join(getFoundryOutDir("production"), "ERC1967Proxy.sol/ERC1967Proxy.json"), "utf8"),
    );
    await seed.client.send("anvil_setCode", [m.pooling.proxy, proxy.deployedBytecode.object]);
    await seed.client.send("anvil_setStorageAt", [
      m.pooling.proxy,
      SOURCE_IMPLEMENTATION_SLOT,
      toBeHex(BigInt(implementation), 32),
    ]);
    const core = new Interface(a["src/modules/CommitmentPooling.sol:CommitmentPoolingModule"].abi);
    await send(
      seed.client,
      m.deployer!,
      m.pooling.proxy,
      core.encodeFunctionData("initialize", [m.authority.address, address(72)]),
    );
    for (const fn of [
      "setGardenToken",
      "setHatsModule",
      "setActionRegistry",
      "setCommitmentRegistry",
      "setWorkApprovalResolver",
      "setEAS",
    ])
      await send(seed.client, m.authority.address, m.pooling.proxy, core.encodeFunctionData(fn, [address(73)]));
    await send(
      seed.client,
      m.authority.address,
      m.pooling.proxy,
      core.encodeFunctionData(
        "setSchemaUIDs",
        [42, 43, 44, 45].map((n) => toBeHex(n, 32)),
      ),
    );
    await send(seed.client, m.authority.address, m.pooling.proxy, core.encodeFunctionData("setPaused", [false]));
    const settlementImplementation = initial.deployments.find(
      (tx) => tx.key === SOURCE_UPGRADE_TARGETS.settlement,
    )!.address;
    m.settlement = {
      ...draft.settlement,
      proxy: address(74),
      implementation: settlementImplementation,
      implementationCodeHash: keccak256(await seed.client.getCode(settlementImplementation)),
    };
    await seed.client.send("anvil_setCode", [m.settlement.proxy, proxy.deployedBytecode.object]);
    await seed.client.send("anvil_setStorageAt", [
      m.settlement.proxy,
      SOURCE_IMPLEMENTATION_SLOT,
      toBeHex(BigInt(settlementImplementation), 32),
    ]);
    const settlement = new Interface(a[SOURCE_UPGRADE_TARGETS.settlement].abi);
    await send(
      seed.client,
      m.deployer!,
      m.settlement.proxy,
      settlement.encodeFunctionData("initialize", [
        m.authority.address,
        address(73),
        m.pooling.proxy,
        address(72),
        address(75),
      ]),
    );
    for (const [fn, args] of [
      ["setBatchSizeLimit", [7]],
      ["setDispatcher", [address(76)]],
      ["setFeeReserveMinimum", [500]],
      ["setCcipRoute", [125, address(77), 100000, 1, 0]],
    ] as const)
      await send(seed.client, m.authority.address, m.settlement.proxy, settlement.encodeFunctionData(fn, args));
    m.nonce = Number(await seed.client.send("eth_getTransactionCount", [m.deployer, "latest"]));
    await seed.client.send("evm_mine", []);
  }, 600_000);
  afterAll(async () => {
    await seed?.stop();
  });
  it("keeps original proxy/owner/counters/dependencies and ends paused without touching upstream", async () => {
    const p = buildSourceUpgradePlan(m, a, commit);
    const result = await simulateSourceUpgradePlan(p, m, a, seed.url, jobs);
    expect(result.paused).toBe(true);
    expect(result.liveBroadcast).toBe(false);
    expect(result.deployments).toHaveLength(23);
    expect(result.ownerCalls).toHaveLength(4);
    expect(result.targets.map((t) => t.target)).toEqual(["pooling", "settlement"]);
    expect(result.planHash).toBe(voucherDigest(p));
    expect(result.sourceCommit).toBe(commit);
    expect(result.manifestHash).toBe(voucherDigest(m));
    expect(result.runtimeBindingHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      result.deployments.every(
        (d) => /^0x[a-f0-9]{64}$/.test(d.runtimeHash) && /^[a-f0-9]{64}$/.test(d.compilerJobHash),
      ),
    ).toBe(true);
    expect(result.targets[0].preserved.nextCommitmentId).toBe(AbiCoder.defaultAbiCoder().encode(["uint256"], [1]));
    expect(result.targets[0].preserved.rootGarden).toBe(AbiCoder.defaultAbiCoder().encode(["address"], [address(72)]));
    expect(result.targets[1].preserved.batchSizeLimit).toBe(AbiCoder.defaultAbiCoder().encode(["uint16"], [7]));
    expect(await seed.client.getStorage(m.pooling.proxy, SOURCE_IMPLEMENTATION_SLOT)).toBe(
      toBeHex(BigInt(m.pooling.implementation), 32),
    );
    for (const tx of p.deployments) expect(await seed.client.getCode(tx.address)).toBe("0x");
  }, 120_000);
  it("rejects nonce drift before deploying", async () => {
    const wrong = structuredClone(m);
    wrong.nonce!++;
    await expect(
      simulateSourceUpgradePlan(buildSourceUpgradePlan(wrong, a, commit), wrong, a, seed.url, jobs),
    ).rejects.toThrow("nonce");
  }, 30_000);
  it("refuses a code-bearing deployment sender before any impersonation", async () => {
    await seed.client.send("anvil_setCode", [m.deployer, "0x60006000f3"]);
    await seed.client.send("evm_mine", []);
    try {
      await expect(
        simulateSourceUpgradePlan(buildSourceUpgradePlan(m, a, commit), m, a, seed.url, jobs),
      ).rejects.toThrow("EOA without code");
    } finally {
      await seed.client.send("anvil_setCode", [m.deployer, "0x"]);
      await seed.client.send("evm_mine", []);
    }
  }, 30_000);
  it("rejects old implementation identity/code drift before upgrades", async () => {
    const wrong = structuredClone(m);
    wrong.pooling.implementationCodeHash = toBeHex(1, 32);
    await expect(
      simulateSourceUpgradePlan(buildSourceUpgradePlan(wrong, a, commit), wrong, a, seed.url, jobs),
    ).rejects.toThrow("implementation code");
  }, 30_000);
  it("rejects Safe authority and mutable transaction plan drift", async () => {
    const wrong = structuredClone(m);
    wrong.authority.owners[0] = address(98);
    await expect(
      simulateSourceUpgradePlan(buildSourceUpgradePlan(wrong, a, commit), wrong, a, seed.url, jobs),
    ).rejects.toThrow("Safe owners");
    const p = buildSourceUpgradePlan(m, a, commit);
    p.ownerCalls[0].data = new Interface(["function transferOwnership(address)"]).encodeFunctionData(
      "transferOwnership",
      [ZeroAddress],
    );
    await expect(simulateSourceUpgradePlan(p, m, a, seed.url, jobs)).rejects.toThrow("plan mismatch");
  }, 30_000);
  it("refuses missing compiler jobs before starting or connecting any fork", async () => {
    await expect(
      simulateSourceUpgradePlan(buildSourceUpgradePlan(m, a, commit), m, a, "not-an-rpc-url"),
    ).rejects.toThrow(/missing compiler job/);
  });
});

describe("selected source upgrade state readback", () => {
  const names = [
    "owner",
    "hatsModule",
    "gardenToken",
    "commitmentRegistry",
    "actionRegistry",
    "workApprovalResolver",
    "eas",
    "workSchemaUID",
    "workApprovalSchemaUID",
    "legacyAssessmentSchemaUID",
    "assessmentV3SchemaUID",
    "nextPoolId",
    "nextCycleId",
    "nextCommitmentId",
    "nextCommitmentSeriesId",
    "protocolPoolId",
    "rootGarden",
  ];
  const abi = new Interface(names.map((name) => `function ${name}() view returns(bytes32)`));
  it("reads the owning fixed getter inventory at the exact requested block", async () => {
    const requests: TransactionRequest[] = [];
    const result = await snapshotSourceUpgradeState(
      {
        call: async (tx) => {
          requests.push(tx);
          return toBeHex(4, 32);
        },
      },
      address(71),
      abi,
      "pooling",
      1234,
    );
    expect(Object.keys(result)).toEqual(names);
    expect(requests).toEqual(
      names.map((name) => ({ to: address(71), data: abi.encodeFunctionData(name), blockTag: 1234 })),
    );
    expect(Object.values(result).every((value) => value === toBeHex(4, 32))).toBe(true);
  });
  it("propagates unavailable historical state instead of substituting latest", async () => {
    await expect(
      snapshotSourceUpgradeState(
        {
          call: async () => {
            throw new Error("historical state unavailable");
          },
        },
        address(71),
        abi,
        "pooling",
        1234,
      ),
    ).rejects.toThrow("historical state unavailable");
  });
  it("keeps default current-state reads explicit without a historical block override", async () => {
    const tags: unknown[] = [];
    await snapshotSourceUpgradeState(
      {
        call: async (tx) => {
          tags.push(tx.blockTag);
          return "0x";
        },
      },
      address(71),
      abi,
      "pooling",
    );
    expect(tags).toEqual(names.map(() => undefined));
  });
  it("refuses an ABI missing a required getter instead of silently shrinking preservation", async () => {
    await expect(
      snapshotSourceUpgradeState(
        { call: async () => "0x" },
        address(71),
        new Interface(["function owner() view returns(address)"]),
        "pooling",
        1234,
      ),
    ).rejects.toThrow();
  });
});
