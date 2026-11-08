import { Interface } from "ethers";
import { describe, expect, it } from "vitest";
import draft from "../../config/clc-garden-exchanges.json";
import { buildCLCGardenPlan, inspectCLCGardenManifest, validateCLCGardenPlan } from "./clc-garden-release";
import { CLC_FACTORY_ABI, CLC_POOL_ABI, CLC_TOKEN_ABI } from "./clc-release";

const commit = "a".repeat(40);
const address = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
function fixture() {
  return { ...structuredClone(draft), deployer: address(42), nonce: 7 };
}

describe("CLC garden pool extension", () => {
  it("adopts GG and the same tokens while deploying only six TAS pool components", () => {
    const plan = buildCLCGardenPlan(fixture(), commit);
    expect(plan.pools.greenGoods.addresses.pool).toBe("0x6AFc963B583fBB536F05B2D7ae832880662b98A4");
    expect(plan.pools.greenGoods.mode).toBe("adopt");
    expect(plan.transactions).toHaveLength(6);
    expect(plan.transactions.map((tx) => tx.nonce)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(plan.newInventory).toEqual({ tokens: 0, pools: 1, administration: 0 });
    expect(plan.issuanceTransactions).toEqual([]);
    expect(plan.assets.find((asset) => asset.id === "techAndSun")?.token).toBe(
      "0xB89300F212fcbdF3D5b73eADE290b3c0d6292143",
    );
    const pool = plan.transactions.at(-1)!;
    expect(pool.admin).toBe(plan.pools.techAndSun.proxyAdmin);
    const deploy = new Interface(CLC_FACTORY_ABI).decodeFunctionData("deployDeterministicAndCall", pool.data);
    const init = new Interface(CLC_POOL_ABI).decodeFunctionData("initialize", deploy[3]);
    expect(init[3]).toBe(plan.pools.techAndSun.owner);
    expect(init[6]).toBe(plan.pools.techAndSun.addresses.index);
    expect(plan.activationIncluded).toBe(false);
    expect(plan.liveBroadcast).toBe(false);
  });

  it("requires explicit new inventory and admission decisions without assigning an invented rate", () => {
    const result = inspectCLCGardenManifest(draft);
    expect(result.deploymentMissing).toEqual(["deployer", "nonce"]);
    expect(result.activationMissing).toContain("local.listings.techAndSun.priceIndex");
    const plan = buildCLCGardenPlan(fixture(), commit);
    expect(plan.configurationTransactions.every((tx) => !tx.executable)).toBe(true);
    expect(plan.fundingTransactions.every((tx) => !tx.executable)).toBe(true);
    expect(plan.configurationTransactions.every((tx) => tx.from === plan.pools.techAndSun.owner)).toBe(true);
  });

  it("binds the exact plan and rejects malformed topology or reused collective sender", () => {
    const m = fixture();
    const plan = buildCLCGardenPlan(m, commit);
    validateCLCGardenPlan(plan, m, commit);
    expect(() => validateCLCGardenPlan({ ...plan, transactions: [] }, m, commit)).toThrow("plan mismatch");
    expect(() => inspectCLCGardenManifest({ ...m, chainId: 42161 })).toThrow();
    expect(() => inspectCLCGardenManifest({ ...m, deployer: m.local.owner })).toThrow();
    expect(() => inspectCLCGardenManifest({ ...m, unusedPool: true })).toThrow();
  });

  it("keeps member token authority with its owner and admits it only to TAS", () => {
    const m = fixture();
    const owner = address(90);
    const proof = { reference: "https://example.org/fictional-approved-service", digest: `0x${"b".repeat(64)}` };
    const member = {
      id: "designer",
      kind: "individual" as const,
      ownerReserve: owner,
      sourceAuthority: address(91),
      name: "Fictional design service",
      symbol: "DSGN",
      service: { unit: "design hour", terms: proof, approval: proof, capacityConfirmed: true },
      initialSupply: "10000000",
      poolInventory: "3000000",
      poolHoldingCap: "6000000",
      adapterAllowance: "1000000",
      priceIndex: "2000000",
      upgradeControl: { kind: "member" },
    };
    const plan = buildCLCGardenPlan({ ...m, members: [member] }, commit);
    const token = plan.transactions.find((tx) => tx.component === "member:designer:token")!;
    expect(token.admin.toLowerCase()).toBe(owner);
    expect(new Interface(CLC_TOKEN_ABI).decodeFunctionData("initialize", token.initializer)[3].toLowerCase()).toBe(
      owner,
    );
    expect(plan.pools.greenGoods.listings.map((listing) => listing.assetId)).toEqual(["greenGoods", "techAndSun"]);
    expect(plan.pools.techAndSun.listings.map((listing) => listing.assetId)).toEqual(["techAndSun", "designer"]);
    expect(plan.issuanceTransactions.every((tx) => tx.from.toLowerCase() === owner)).toBe(true);
  });
});
