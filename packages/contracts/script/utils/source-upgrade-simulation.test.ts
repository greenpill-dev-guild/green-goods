import { readFileSync } from "node:fs";
import path from "node:path";
import { AbiCoder, Interface, type JsonRpcProvider, keccak256, toBeHex, toQuantity, ZeroAddress } from "ethers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import draft from "../../config/source-upgrade-release.json";
import { minedIsolatedReceipt } from "./isolated-fork";
import { createIsolatedSeed } from "./isolated-fork.fixtures";
import { getFoundryOutDir } from "./paths";
import {
  buildSourceUpgradePlan,
  loadSourceUpgradeArtifacts,
  SOURCE_IMPLEMENTATION_SLOT,
  type SourceUpgradeManifest,
} from "./source-upgrade-release";
import { simulateSourceUpgradePlan } from "./source-upgrade-simulation";

const address = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const commit = "b".repeat(40);
let seed: Awaited<ReturnType<typeof createIsolatedSeed>>;
let m: SourceUpgradeManifest;
let a: ReturnType<typeof loadSourceUpgradeArtifacts>;
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
beforeAll(async () => {
  seed = await createIsolatedSeed(42161);
  m = {
    ...structuredClone(draft),
    chainId: 42161,
    schemaVersion: 1,
    deployer: address(91),
    nonce: 0,
    authority: { ...draft.authority, nonce: 0 },
    settlement: null,
  };
  a = loadSourceUpgradeArtifacts(getFoundryOutDir("production"), m);
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
  m.nonce = Number(await seed.client.send("eth_getTransactionCount", [m.deployer, "latest"]));
  await seed.client.send("evm_mine", []);
}, 120_000);
afterAll(async () => {
  await seed?.stop();
});
describe("production existing source upgrade on process-owned forks", () => {
  it("keeps original proxy/owner/counters/dependencies and ends paused without touching upstream", async () => {
    const p = buildSourceUpgradePlan(m, a, commit);
    const result = await simulateSourceUpgradePlan(p, m, a, seed.url);
    expect(result.paused).toBe(true);
    expect(result.liveBroadcast).toBe(false);
    expect(result.targets[0].preserved.nextCommitmentId).toBe(AbiCoder.defaultAbiCoder().encode(["uint256"], [1]));
    expect(result.targets[0].preserved.rootGarden).toBe(AbiCoder.defaultAbiCoder().encode(["address"], [address(72)]));
    expect(await seed.client.getStorage(m.pooling.proxy, SOURCE_IMPLEMENTATION_SLOT)).toBe(
      toBeHex(BigInt(m.pooling.implementation), 32),
    );
    for (const tx of p.deployments) expect(await seed.client.getCode(tx.address)).toBe("0x");
  }, 120_000);
  it("rejects nonce drift before deploying", async () => {
    const wrong = structuredClone(m);
    wrong.nonce!++;
    await expect(
      simulateSourceUpgradePlan(buildSourceUpgradePlan(wrong, a, commit), wrong, a, seed.url),
    ).rejects.toThrow("nonce");
  }, 30_000);
  it("refuses a code-bearing deployment sender before any impersonation", async () => {
    await seed.client.send("anvil_setCode", [m.deployer, "0x60006000f3"]);
    await seed.client.send("evm_mine", []);
    try {
      await expect(simulateSourceUpgradePlan(buildSourceUpgradePlan(m, a, commit), m, a, seed.url)).rejects.toThrow(
        "EOA without code",
      );
    } finally {
      await seed.client.send("anvil_setCode", [m.deployer, "0x"]);
      await seed.client.send("evm_mine", []);
    }
  }, 30_000);
  it("rejects old implementation identity/code drift before upgrades", async () => {
    const wrong = structuredClone(m);
    wrong.pooling.implementationCodeHash = toBeHex(1, 32);
    await expect(
      simulateSourceUpgradePlan(buildSourceUpgradePlan(wrong, a, commit), wrong, a, seed.url),
    ).rejects.toThrow("implementation code");
  }, 30_000);
  it("rejects Safe authority and mutable transaction plan drift", async () => {
    const wrong = structuredClone(m);
    wrong.authority.owners[0] = address(98);
    await expect(
      simulateSourceUpgradePlan(buildSourceUpgradePlan(wrong, a, commit), wrong, a, seed.url),
    ).rejects.toThrow("Safe owners");
    const p = buildSourceUpgradePlan(m, a, commit);
    p.ownerCalls[0].data = new Interface(["function transferOwnership(address)"]).encodeFunctionData(
      "transferOwnership",
      [ZeroAddress],
    );
    await expect(simulateSourceUpgradePlan(p, m, a, seed.url)).rejects.toThrow("plan mismatch");
  }, 30_000);
});
