import { Contract, getAddress, Interface, isError, keccak256, type JsonRpcProvider } from "ethers";
import type { CLCMemberManifest } from "./clc-member-inputs";
import type { CLCMemberPlan } from "./clc-member-release";
import {
  CLC_DEPENDENCIES,
  CLC_FACTORY_ABI,
  CLC_FACTORY_INIT_CODE_HASH,
  CLC_INDEX_ABI,
  CLC_LIMITER_ABI,
  CLC_QUOTER_ABI,
  CLC_TOKEN_ABI,
} from "./clc-release";

const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const FACTORY_ADMIN_ABI = [
  "function changeAdmin(address proxy,address admin)",
  "function upgrade(address proxy,address implementation)",
];
function equal(actual: unknown, expected: unknown, label: string): void {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) throw new Error(`CLC member ${label} mismatch`);
}
/** Exact Solady proxy bytes; the init-code hash independently binds this published recipe to the factory. */
export function getCLCProxyRuntime(): string {
  const runtime = `0x3d3d3373${CLC_DEPENDENCIES.factory.address.slice(2).toLowerCase()}14605757363d3d37363d7f${IMPLEMENTATION_SLOT.slice(2)}545af43d6000803e6052573d6000fd5b3d6000f35b3d356020355560408036111560525736038060403d373d3d355af43d6000803e6052573d6000fd`;
  equal(keccak256(`0x607f3d8160093d39f3${runtime.slice(2)}`), CLC_FACTORY_INIT_CODE_HASH, "proxy runtime recipe");
  return runtime;
}
export async function verifyCLCMemberInitialState(
  provider: Pick<JsonRpcProvider, "call" | "getCode" | "getStorage">,
  plan: CLCMemberPlan,
  manifest: CLCMemberManifest,
) {
  const runner = { provider: null, call: provider.call.bind(provider) };
  const factory = new Contract(CLC_DEPENDENCIES.factory.address, [...CLC_FACTORY_ABI, ...FACTORY_ADMIN_ABI], runner);
  const checks = [];
  for (const asset of plan.memberAssets) {
    equal(await provider.getCode(asset.token), getCLCProxyRuntime(), "exact member proxy runtime");
    equal(
      getAddress(`0x${(await provider.getStorage(asset.token, IMPLEMENTATION_SLOT)).slice(-40)}`),
      CLC_DEPENDENCIES.token.address,
      "member implementation",
    );
    equal(await factory.adminOf(asset.token), asset.admin, "member factory administrator");
    const token = new Contract(asset.token, CLC_TOKEN_ABI, runner);
    for (const [method, expected] of [
      ["owner", asset.ownerReserve],
      ["name", asset.name],
      ["symbol", asset.symbol],
      ["decimals", 6],
      ["expired", false],
      ["totalSupply", 0],
      ["totalMinted", 0],
      ["totalBurned", 0],
    ] as const)
      equal(await token[method](), expected, `member ${method}`);
    equal(await token.isWriter(asset.ownerReserve), true, "member owner writer");
    const others = new Set(
      [
        manifest.base.deployer,
        manifest.members.deployer,
        manifest.base.greenGoodsSafe,
        manifest.base.techAndSunSafe,
        manifest.base.earnedAdapter,
        ...plan.memberAssets.filter((other) => other.id !== asset.id).map((other) => other.ownerReserve),
      ].filter((value): value is string => value !== null),
    );
    for (const actor of others) {
      if (getAddress(actor) !== asset.ownerReserve)
        equal(await token.isWriter(actor), false, "no inherited member writer");
      equal(await token.balanceOf(actor), 0, "no initial actor balance");
    }
    equal(await token.balanceOf(asset.ownerReserve), 0, "empty member reserve");
    equal(await token.balanceOf(plan.addresses.pool), 0, "empty member pool inventory");
    for (const spender of [plan.addresses.pool, manifest.base.earnedAdapter].filter(
      (value): value is string => value !== null,
    ))
      equal(await token.allowance(asset.ownerReserve, spender), 0, "no initial member allowance");
    equal(
      await new Contract(plan.addresses.index, CLC_INDEX_ABI, runner).have(asset.token),
      false,
      "unregistered member token",
    );
    equal(
      await new Contract(plan.addresses.limiter, CLC_LIMITER_ABI, runner).limitOf(asset.token, plan.addresses.pool),
      0,
      "no initial member holding cap",
    );
    equal(
      await new Contract(
        plan.addresses.quoter,
        [...CLC_QUOTER_ABI, "function priceIndex(address) view returns(uint256)"],
        runner,
      ).priceIndex(asset.token),
      0,
      "no initial member price index",
    );
    // Read-only eth_call probes against the pinned factory, not replayable signatures or submitted upgrades.
    const abi = new Interface(FACTORY_ADMIN_ABI);
    for (const [method, args] of [
      ["changeAdmin", [asset.token, asset.admin]],
      ["upgrade", [asset.token, CLC_DEPENDENCIES.token.address]],
    ] as const) {
      const data = abi.encodeFunctionData(method, args);
      await provider.call({ from: asset.ownerReserve, to: CLC_DEPENDENCIES.factory.address, data, value: 0 });
      for (const actor of others) {
        if (getAddress(actor) === asset.ownerReserve) continue;
        let rejected = false;
        try {
          await provider.call({ from: actor, to: CLC_DEPENDENCIES.factory.address, data, value: 0 });
        } catch (error) {
          if (!isError(error, "CALL_EXCEPTION")) throw error;
          rejected = true;
        }
        if (!rejected) throw new Error("Unapproved actor can administer member token");
      }
    }
    const tx = plan.transactions.find((row) => row.address === asset.token);
    if (!tx?.initializer) throw new Error("Member deployment initializer missing");
    let reinitialized = false;
    try {
      await provider.call({ from: manifest.members.deployer, to: asset.token, data: tx.initializer });
      reinitialized = true;
    } catch (error) {
      if (!isError(error, "CALL_EXCEPTION")) throw error;
    }
    if (reinitialized) throw new Error("Member token accepted reinitialization");
    checks.push({
      id: asset.id,
      token: asset.token,
      ownerReserve: asset.ownerReserve,
      admin: asset.admin,
      sourceAuthority: asset.sourceAuthority,
      initialSupply: "0",
      initialAllowance: "0",
      factoryControl: "member-direct-readonly-call-proved",
    });
  }
  return checks;
}
