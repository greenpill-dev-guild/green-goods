import { id, Interface, type JsonRpcProvider, type TransactionRequest, zeroPadValue } from "ethers";
import { describe, expect, it } from "vitest";
import draft from "../../config/clc-garden-exchanges.json";
import sources from "../../deployments/42161-pilot-downstream.json";
import { readCLCAdoptedGardenState, verifyCLCGardenAuthorities } from "./clc-garden-readback";
import { buildCLCGardenPlan, CLC_POOL_COMPONENTS, existingCLCAddress } from "./clc-garden-release";
import { getCLCProxyRuntime } from "./clc-member-readback";
import { CLC_DEPENDENCIES } from "./clc-release";

const MANAGER = "0xfBf07b2d0e5eA8249756F205e5214B9d7cDF4e66";
const other = "0x0000000000000000000000000000000000000099";
function fixture(managed: boolean) {
  const plan = buildCLCGardenPlan({ ...draft, deployer: other, nonce: 0 }, "a".repeat(40));
  const pool = plan.pools.greenGoods;
  const abi = new Interface([
    "function owner() view returns(address)",
    "function adminOf(address) view returns(address)",
    "function hasRole(uint64,address) view returns(bool,uint32)",
    "function decimals() view returns(uint8)",
    "function expired() view returns(bool)",
    "function have(address) view returns(bool)",
    "function totalSupply() view returns(uint256)",
    "function totalMinted() view returns(uint256)",
    "function totalBurned() view returns(uint256)",
    "function balanceOf(address) view returns(uint256)",
    "function allowance(address,address) view returns(uint256)",
    "function tokenRegistry() view returns(address)",
    "function tokenLimiter() view returns(address)",
    "function quoter() view returns(address)",
    "function feePolicy() view returns(address)",
    "function protocolFeeController() view returns(address)",
    "function feeAddress() view returns(address)",
    "function feesDecoupled() view returns(bool)",
    "function guardian() view returns(address)",
    "function LOCAL_CHAIN_ID() view returns(uint256)",
    "function remoteChainId() view returns(uint256)",
    "function remoteChainSelector() view returns(uint64)",
    "function remotePeer() view returns(address)",
    "function paused() view returns(bool)",
    "function CCIP_ROUTER() view returns(address)",
    "function assetAuthorizations(address,address) view returns(address,bool)",
  ]);
  const state = {
    manager: managed ? MANAGER : (null as string | null),
    admin: true,
    admitted: true,
    peer: null as string | null,
    chain: 100n,
  };
  const components = new Map(
    CLC_POOL_COMPONENTS.map((component) => [pool.addresses[component].toLowerCase(), component]),
  );
  const token = (target: string) => plan.assets.find((asset) => asset.token.toLowerCase() === target.toLowerCase());
  const provider = {
    getNetwork: async () => ({ chainId: state.chain }),
    getCode: async () => getCLCProxyRuntime(),
    getStorage: async (target: string) => {
      const component = components.get(target.toLowerCase());
      return zeroPadValue(
        component ? CLC_DEPENDENCIES[component].address : token(target) ? CLC_DEPENDENCIES.token.address : other,
        32,
      );
    },
    call: async (request: TransactionRequest) => {
      const parsed = abi.parseTransaction({ data: String(request.data) });
      if (!parsed) throw new Error("Unknown fixture call");
      const target = String(request.to),
        asset = token(target),
        name = parsed.name;
      const keys: Record<string, keyof typeof pool.addresses> = {
        tokenRegistry: "index",
        tokenLimiter: "limiter",
        quoter: "quoter",
        feePolicy: "feePolicy",
        protocolFeeController: "protocolFee",
      };
      let result: unknown[];
      if (name === "owner") result = [asset?.id === "techAndSun" ? asset.ownerReserve : (state.manager ?? pool.owner)];
      else if (name === "adminOf")
        result = [
          token(parsed.args[0])?.id === "techAndSun" ? existingCLCAddress("techAndSunTimelock") : pool.proxyAdmin,
        ];
      else if (name === "hasRole") result = [state.admin, 0];
      else if (keys[name]) result = [pool.addresses[keys[name]]];
      else if (name === "feeAddress") result = [pool.owner];
      else if (name === "decimals") result = [6];
      else if (name === "expired" || name === "paused") result = [false];
      else if (name === "have") result = [state.admitted];
      else if (name === "feesDecoupled") result = [true];
      else if (name === "totalSupply" || name === "totalMinted") result = [20_000_000n];
      else if (name === "totalBurned") result = [0];
      else if (name === "balanceOf" || name === "allowance") result = [10_000_000n];
      else if (name === "guardian" || name === "CCIP_ROUTER") result = [other];
      else if (name === "LOCAL_CHAIN_ID") result = [100];
      else if (name === "remoteChainId") result = [42161];
      else if (name === "remoteChainSelector") result = [4949039107694359620n];
      else if (name === "remotePeer")
        result = [
          state.peer ??
            sources.contracts.findLast(
              (row) =>
                row.contract ===
                (target.toLowerCase() === existingCLCAddress("GnosisVoucherAdapter").toLowerCase()
                  ? "VoucherEntitlementModule"
                  : "VoucherRedemptionModule"),
            )!.address,
        ];
      else if (name === "assetAuthorizations") result = [other, true];
      else throw new Error(`Unhandled fixture call ${name}`);
      return abi.encodeFunctionResult(name, result);
    },
  } as unknown as JsonRpcProvider;
  return { plan, provider, state };
}
describe("adopting an active Green Goods pool", () => {
  it.each([false, true])("accepts funded existing tokens with reviewed managed authority=%s", async (managed) => {
    const f = fixture(managed);
    const state = await readCLCAdoptedGardenState(f.provider, f.plan);
    expect(state.tokens.map((token) => token.totalSupply)).toEqual(["20000000", "20000000"]);
    expect(state.tokens.map((token) => token.ggInventory)).toEqual(["10000000", "10000000"]);
    expect(state.bindings[0].authorizations[0].issuerAuthority.toLowerCase()).toBe(other.toLowerCase());
  });
  it.each([
    "unapproved-manager",
    "missing-safe-role",
    "unadmitted-token",
    "wrong-peer",
    "wrong-chain",
  ])("rejects %s", async (fault) => {
    const f = fixture(true);
    if (fault === "unapproved-manager") f.state.manager = other;
    if (fault === "missing-safe-role") f.state.admin = false;
    if (fault === "unadmitted-token") f.state.admitted = false;
    if (fault === "wrong-peer") f.state.peer = other;
    if (fault === "wrong-chain") f.state.chain = 42161n;
    await expect(readCLCAdoptedGardenState(f.provider, f.plan)).rejects.toThrow();
  });
});

describe("adopted garden governance", () => {
  function authorityFixture() {
    const plan = buildCLCGardenPlan({ ...draft, deployer: other, nonce: 0 }, "a".repeat(40));
    const guard = "0x0000000000000000000000000000000000000088";
    const abi = new Interface([
      "function getThreshold() view returns(uint256)",
      "function getOwners() view returns(address[])",
      "function getModulesPaginated(address,uint256) view returns(address[],address)",
      "function safe() view returns(address)",
      "function locked() view returns(bool)",
      "function thresholdConfig() view returns(uint8,uint120,uint120)",
      "function TIMELOCK_ADMIN_ROLE() view returns(bytes32)",
      "function hasRole(bytes32,address) view returns(bool)",
      "function getMinDelay() view returns(uint256)",
    ]);
    const state = { threshold: 1, locked: false, minimum: 1, safeRole: true };
    const provider = {
      getStorage: async () => zeroPadValue(guard, 32),
      getCode: async () => "0x6000",
      call: async (request: TransactionRequest) => {
        const parsed = abi.parseTransaction({ data: String(request.data) })!;
        const target = String(request.to).toLowerCase();
        const local = plan.pools.techAndSun;
        const pool = Object.values(plan.pools).find((row) => row.proxyAdmin.toLowerCase() === target);
        let result: unknown[];
        if (parsed.name === "getThreshold") result = [target === local.owner.toLowerCase() ? state.threshold : 2];
        else if (parsed.name === "getOwners") result = [[guard, other]];
        else if (parsed.name === "safe") result = [local.owner];
        else if (parsed.name === "locked") result = [state.locked];
        else if (parsed.name === "thresholdConfig") result = [0, state.minimum, state.minimum];
        else if (parsed.name === "getModulesPaginated")
          result = [[guard], "0x0000000000000000000000000000000000000001"];
        else if (parsed.name === "TIMELOCK_ADMIN_ROLE") result = [id("TIMELOCK_ADMIN_ROLE")];
        else if (parsed.name === "getMinDelay") result = [pool?.id === "green-goods" ? 86400 : 0];
        else if (parsed.name === "hasRole")
          result = [
            parsed.args[0] === id("TIMELOCK_ADMIN_ROLE")
              ? parsed.args[1].toLowerCase() === target
              : parsed.args[1].toLowerCase() === pool?.owner.toLowerCase() && state.safeRole,
          ];
        else throw new Error(`Unknown governance call ${parsed.name}`);
        return abi.encodeFunctionResult(parsed.name, result);
      },
    } as unknown as JsonRpcProvider;
    return { plan, provider, state };
  }
  it("preserves the existing nonzero GG delay and selected TAS one-approval policy", async () => {
    const f = authorityFixture();
    const result = await verifyCLCGardenAuthorities(f.provider, f.plan);
    expect(result.map((row) => [row.poolId, row.threshold, row.minDelay])).toEqual([
      ["green-goods", 2, "86400"],
      ["tech-and-sun", 1, "0"],
    ]);
  });
  it.each(["threshold", "locked", "minimum", "safe-role"])("rejects a changed %s policy", async (fault) => {
    const f = authorityFixture();
    if (fault === "threshold") f.state.threshold = 2;
    if (fault === "locked") f.state.locked = true;
    if (fault === "minimum") f.state.minimum = 2;
    if (fault === "safe-role") f.state.safeRole = false;
    await expect(verifyCLCGardenAuthorities(f.provider, f.plan)).rejects.toThrow();
  });
});
