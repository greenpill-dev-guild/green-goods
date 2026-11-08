import { Contract, getAddress, id, JsonRpcProvider, keccak256, ZeroAddress } from "ethers";
import sourceDeployments from "../../deployments/42161-pilot-downstream.json";
import {
  CLC_POOL_COMPONENTS,
  type CLCGardenManifest,
  type CLCGardenPlan,
  type CLCGardenPool,
  existingCLCAddress,
} from "./clc-garden-release";
import { getCLCProxyRuntime } from "./clc-member-readback";
import {
  CLC_DEPENDENCIES,
  CLC_FACTORY_ABI,
  CLC_FEE_POLICY_ABI,
  CLC_INDEX_ABI,
  CLC_POOL_ABI,
  CLC_PROTOCOL_FEE_ABI,
  CLC_TIMELOCK_ABI,
  CLC_TOKEN_ABI,
} from "./clc-release";

const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const GUARD_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";
const GG_ACCESS_MANAGER = "0xfBf07b2d0e5eA8249756F205e5214B9d7cDF4e66";
function equal(actual: unknown, expected: unknown, label: string): void {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) throw new Error(`CLC garden ${label} mismatch`);
}
const storedAddress = (word: string) => getAddress(`0x${word.slice(-40)}`);
async function reviewedOwner(provider: JsonRpcProvider, target: string, owner: string, managed: boolean) {
  const actual = getAddress(await new Contract(target, ["function owner() view returns(address)"], provider).owner());
  if (actual === getAddress(owner)) return actual;
  if (!managed || actual !== GG_ACCESS_MANAGER || (await provider.getCode(actual)) === "0x")
    throw new Error("CLC garden approved owner mismatch");
  const manager = new Contract(actual, ["function hasRole(uint64,address) view returns(bool,uint32)"], provider);
  const [member] = await manager.hasRole(0, owner);
  equal(member, true, "Green Goods Safe AccessManager administration");
  return actual;
}
async function proxy(provider: JsonRpcProvider, target: string, implementation: string, admin: string) {
  equal(await provider.getCode(target), getCLCProxyRuntime(), "proxy runtime");
  equal(storedAddress(await provider.getStorage(target, IMPLEMENTATION_SLOT)), implementation, "implementation");
  equal(
    await new Contract(CLC_DEPENDENCIES.factory.address, CLC_FACTORY_ABI, provider).adminOf(target),
    admin,
    "proxy administrator",
  );
}
/** Curation and redemption do not depend on an empty reserve or an unused exchange. */
export async function readCLCAdoptedGardenState(provider: JsonRpcProvider, plan: CLCGardenPlan) {
  equal((await provider.getNetwork()).chainId, 100, "chain");
  const pool = plan.pools.greenGoods;
  await verifyCLCGardenPool(provider, pool);
  const index = new Contract(pool.addresses.index, CLC_INDEX_ABI, provider);
  const tokens = [];
  const adapter = existingCLCAddress("GnosisVoucherAdapter");
  for (const asset of plan.assets.filter((row) => row.mode === "adopt")) {
    const admin = existingCLCAddress(asset.id === "greenGoods" ? "greenGoodsTimelock" : "techAndSunTimelock");
    await proxy(provider, asset.token, CLC_DEPENDENCIES.token.address, admin);
    const token = new Contract(asset.token, CLC_TOKEN_ABI, provider);
    const tokenOwner = await reviewedOwner(provider, asset.token, asset.ownerReserve, asset.id === "greenGoods");
    equal(await token.decimals(), 6, "adopted token decimals");
    equal(await token.expired(), false, "adopted token expiry");
    equal(await index.have(asset.token), true, "existing GG token admission");
    tokens.push({
      id: asset.id,
      token: asset.token,
      owner: asset.ownerReserve,
      tokenOwner,
      totalSupply: String(await token.totalSupply()),
      totalMinted: String(await token.totalMinted()),
      totalBurned: String(await token.totalBurned()),
      reserveBalance: String(await token.balanceOf(asset.ownerReserve)),
      ggInventory: String(await token.balanceOf(pool.addresses.pool)),
      adapterAllowance: String(await token.allowance(asset.ownerReserve, adapter)),
    });
  }
  const bindings = [];
  for (const [name, sourceName] of [
    ["GnosisVoucherAdapter", "VoucherEntitlementModule"],
    ["GnosisVoucherEscrow", "VoucherRedemptionModule"],
  ]) {
    const target = existingCLCAddress(name);
    const code = await provider.getCode(target);
    if (code === "0x") throw new Error(`Missing ${name}`);
    const endpoint = new Contract(
      target,
      [
        "function guardian() view returns(address)",
        "function CCIP_ROUTER() view returns(address)",
        "function LOCAL_CHAIN_ID() view returns(uint256)",
        "function remoteChainId() view returns(uint256)",
        "function remoteChainSelector() view returns(uint64)",
        "function remotePeer() view returns(address)",
        "function paused() view returns(bool)",
        "function assetAuthorizations(address,address) view returns(address,bool)",
      ],
      provider,
    );
    const source = sourceDeployments.contracts.findLast((row) => row.contract === sourceName)?.address;
    if (!source) throw new Error(`Missing source ${sourceName}`);
    const owner = await reviewedOwner(provider, target, plan.pools.greenGoods.owner, true);
    const guardian = getAddress(await endpoint.guardian());
    if (guardian === getAddress(owner)) throw new Error("Endpoint guardian must remain separate from owner");
    equal(await endpoint.LOCAL_CHAIN_ID(), 100, "endpoint destination chain");
    equal(await endpoint.remoteChainId(), 42161, "endpoint source chain");
    equal(await endpoint.remoteChainSelector(), 4949039107694359620n, "endpoint source selector");
    equal(await endpoint.remotePeer(), source, "endpoint source peer");
    const implementation = storedAddress(await provider.getStorage(target, IMPLEMENTATION_SLOT));
    const implementationCode = await provider.getCode(implementation);
    if (implementationCode === "0x") throw new Error("Missing voucher implementation");
    const authorizations =
      name === "GnosisVoucherAdapter"
        ? await Promise.all(
            plan.assets
              .filter((row) => row.mode === "adopt")
              .map(async (asset) => {
                const authorization = await endpoint.assetAuthorizations(asset.ownerReserve, asset.token);
                return { assetId: asset.id, issuerAuthority: getAddress(authorization[0]), enabled: authorization[1] };
              }),
          )
        : [];
    bindings.push({
      name,
      address: target,
      runtimeHash: keccak256(code),
      implementation,
      implementationHash: keccak256(implementationCode),
      owner,
      guardian,
      router: getAddress(await endpoint.CCIP_ROUTER()),
      source,
      paused: await endpoint.paused(),
      authorizations,
    });
  }
  return { tokens, bindings };
}
export async function verifyCLCGardenPool(
  provider: JsonRpcProvider,
  pool: CLCGardenPool,
  manifest?: CLCGardenManifest,
) {
  for (const key of CLC_POOL_COMPONENTS) {
    await proxy(provider, pool.addresses[key], CLC_DEPENDENCIES[key].address, pool.proxyAdmin);
    await reviewedOwner(provider, pool.addresses[key], pool.owner, pool.mode === "adopt");
  }
  const contract = new Contract(pool.addresses.pool, CLC_POOL_ABI, provider);
  for (const [method, key] of [
    ["tokenRegistry", "index"],
    ["tokenLimiter", "limiter"],
    ["quoter", "quoter"],
    ["feePolicy", "feePolicy"],
    ["protocolFeeController", "protocolFee"],
  ] as const)
    equal(await contract[method](), pool.addresses[key], `${pool.id} ${method}`);
  equal(await contract.feeAddress(), pool.owner, "pool fee recipient");
  equal(await contract.feesDecoupled(), true, "pool fee separation");
  if (manifest) {
    equal(await contract.name(), manifest.local.name, "local pool name");
    equal(await contract.symbol(), manifest.local.symbol, "local pool symbol");
    equal(await contract.decimals(), 6, "local pool decimals");
    equal(
      await new Contract(pool.addresses.index, CLC_INDEX_ABI, provider).entryCount(),
      0,
      "unactivated local registry",
    );
    equal(
      await new Contract(pool.addresses.feePolicy, CLC_FEE_POLICY_ABI, provider).getDefaultFee(),
      manifest.local.poolFee,
      "local pool fee",
    );
    const protocol = new Contract(pool.addresses.protocolFee, CLC_PROTOCOL_FEE_ABI, provider);
    equal(await protocol.getProtocolFee(), manifest.local.protocolFee, "local protocol fee");
    equal(await protocol.getProtocolFeeRecipient(), pool.owner, "local protocol fee recipient");
    for (const token of [existingCLCAddress("greenGoodsToken"), existingCLCAddress("techAndSunToken")])
      equal(
        await new Contract(token, CLC_TOKEN_ABI, provider).balanceOf(pool.addresses.pool),
        0,
        "unfunded local pool",
      );
  }
}
/** Preserve the separately accepted one-approval TAS policy; never finalize its bootstrap here. */
export async function verifyCLCGardenAuthorities(provider: JsonRpcProvider, plan: CLCGardenPlan) {
  const result = [];
  for (const pool of Object.values(plan.pools)) {
    const safe = new Contract(
      pool.owner,
      [
        "function getThreshold() view returns(uint256)",
        "function getOwners() view returns(address[])",
        "function getModulesPaginated(address,uint256) view returns(address[],address)",
      ],
      provider,
    );
    const owners: string[] = await safe.getOwners();
    const threshold = Number(await safe.getThreshold());
    if (!owners.length || threshold < 1 || threshold > owners.length) throw new Error("Invalid pool Safe authority");
    if (pool.id === "tech-and-sun") {
      equal(threshold, 1, "TAS one-approval policy");
      const gateAddress = storedAddress(await provider.getStorage(pool.owner, GUARD_SLOT));
      const gate = new Contract(
        gateAddress,
        [
          "function safe() view returns(address)",
          "function locked() view returns(bool)",
          "function thresholdConfig() view returns(uint8,uint120,uint120)",
        ],
        provider,
      );
      equal(await gate.safe(), pool.owner, "TAS guard binding");
      equal(await gate.locked(), false, "TAS bootstrap remains unfinalized");
      const config = await gate.thresholdConfig();
      equal(config[0], 0, "TAS absolute threshold");
      equal(config[1], 1, "TAS minimum");
      equal(config[2], 1, "TAS target");
      const [modules, next] = await safe.getModulesPaginated("0x0000000000000000000000000000000000000001", 2);
      equal(modules.length, 1, "TAS sole module count");
      equal(modules[0], gateAddress, "TAS sole guard module");
      equal(next, "0x0000000000000000000000000000000000000001", "TAS module list end");
    }
    // Existing GG governance has a nonzero delay. Adoption preserves that policy;
    // the historical bootstrap verifier intentionally requires a zero delay.
    const timelock = new Contract(pool.proxyAdmin, CLC_TIMELOCK_ABI, provider);
    const admin = await timelock.TIMELOCK_ADMIN_ROLE();
    equal(admin, id("TIMELOCK_ADMIN_ROLE"), "timelock admin identity");
    equal(await timelock.hasRole(admin, pool.proxyAdmin), true, "timelock self administration");
    equal(await timelock.hasRole(admin, pool.owner), false, "Safe has no bypass admin role");
    equal(await timelock.hasRole(admin, plan.transactions[0].from), false, "deployer has no admin role");
    for (const role of [id("PROPOSER_ROLE"), id("EXECUTOR_ROLE"), id("CANCELLER_ROLE")]) {
      equal(await timelock.hasRole(role, pool.owner), true, "pool Safe timelock authority");
      equal(await timelock.hasRole(role, plan.transactions[0].from), false, "deployer has no timelock role");
      equal(await timelock.hasRole(role, ZeroAddress), false, "closed timelock authority");
    }
    result.push({
      poolId: pool.id,
      owner: pool.owner,
      threshold,
      owners,
      timelock: pool.proxyAdmin,
      timelockRuntimeHash: keccak256(await provider.getCode(pool.proxyAdmin)),
      minDelay: String(await timelock.getMinDelay()),
    });
  }
  return result;
}
