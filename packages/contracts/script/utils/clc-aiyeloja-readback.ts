import { Contract, getAddress, JsonRpcProvider, keccak256 } from "ethers";
import { type CLCAiyelojaPlan, AIYELOJA_MULTISEND, AIYELOJA_TEST_SAFE } from "./clc-aiyeloja-release";
import {
  CLC_DEPENDENCIES,
  CLC_FACTORY_ABI,
  CLC_FACTORY_INIT_CODE_HASH,
  CLC_INDEX_ABI,
  CLC_LIMITER_ABI,
  CLC_FEE_POLICY_ABI,
  CLC_PROTOCOL_FEE_ABI,
  CLC_POOL_ABI,
  CLC_TOKEN_ABI,
} from "./clc-release";
import { existingCLCAddress } from "./clc-garden-release";
import { getCLCProxyRuntime } from "./clc-member-readback";
import pilot from "../../deployments/100-pilot-downstream.json";
import { voucherDigest } from "./voucher-release";

export function aiyelojaEqual(actual: unknown, expected: unknown, label: string): void {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) throw new Error(`Aiyeloja ${label} mismatch`);
}
export const AIYELOJA_SAFE_ABI = [
  "function getOwners() view returns(address[])",
  "function getThreshold() view returns(uint256)",
  "function nonce() view returns(uint256)",
  "function getModulesPaginated(address,uint256) view returns(address[],address)",
  "function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) returns(bool)",
  "function getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256) view returns(bytes32)",
  "event ExecutionSuccess(bytes32 txHash,uint256 payment)",
  "event ExecutionFailure(bytes32 txHash,uint256 payment)",
];
const SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
export async function verifyAiyelojaAuthority(provider: JsonRpcProvider, plan: CLCAiyelojaPlan, initialNonce = false) {
  aiyelojaEqual((await provider.getNetwork()).chainId, 100, "chain");
  const safe = new Contract(AIYELOJA_TEST_SAFE, AIYELOJA_SAFE_ABI, provider);
  const owners: string[] = (await safe.getOwners()).map(getAddress);
  aiyelojaEqual([...owners].sort().join(), [...plan.safeOwners].sort().join(), "reviewed test Safe owners");
  aiyelojaEqual(await safe.getThreshold(), 1, "one-signature test Safe");
  if (initialNonce) aiyelojaEqual(await safe.nonce(), plan.batches[0].nonce, "initial Safe nonce");
  aiyelojaEqual(
    (await provider.getStorage(plan.safe, 0)).slice(-40),
    "29fcb43b46531bca003ddc8fcb67ffe91900c762",
    "Safe singleton",
  );
  const [modules, next] = await safe.getModulesPaginated("0x0000000000000000000000000000000000000001", 1);
  aiyelojaEqual(modules.length, 0, "ordinary Safe has no modules");
  aiyelojaEqual(next, "0x0000000000000000000000000000000000000001", "module list end");
  aiyelojaEqual(
    await provider.getStorage(plan.safe, keccak256(new TextEncoder().encode("guard_manager.guard.address"))),
    `0x${"00".repeat(32)}`,
    "no guard",
  );
  aiyelojaEqual(
    await provider.getStorage(plan.safe, keccak256(new TextEncoder().encode("module_manager.module_guard.address"))),
    `0x${"00".repeat(32)}`,
    "no module guard",
  );
  aiyelojaEqual(
    keccak256(await provider.getCode(plan.safe)),
    "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c",
    "pinned Safe proxy runtime",
  );
  aiyelojaEqual(
    keccak256(await provider.getCode(AIYELOJA_MULTISEND)),
    "0xa9865ac2d9c7a1591619b188c4d88167b50df6cc0c5327fcbd1c8c75f7c066ad",
    "pinned MultiSendCallOnly runtime",
  );
  return {
    safe: plan.safe,
    owners,
    threshold: 1,
    nonce: String(await safe.nonce()),
    safeRuntimeHash: keccak256(await provider.getCode(plan.safe)),
    multiSendRuntimeHash: keccak256(await provider.getCode(AIYELOJA_MULTISEND)),
  };
}
export async function verifyAiyelojaDependencies(provider: JsonRpcProvider) {
  for (const [name, pin] of Object.entries(CLC_DEPENDENCIES))
    aiyelojaEqual(keccak256(await provider.getCode(pin.address)), pin.runtimeHash, `${name} dependency`);
  aiyelojaEqual(
    await new Contract(CLC_DEPENDENCIES.factory.address, CLC_FACTORY_ABI, provider).initCodeHash(),
    CLC_FACTORY_INIT_CODE_HASH,
    "factory init code",
  );
}
/** Snapshot the production pool, voucher reserves, endpoint permissions and both steward Safes. */
export async function aiyelojaProductionSnapshot(provider: JsonRpcProvider, plan: CLCAiyelojaPlan) {
  const pool = existingCLCAddress("pool"),
    index = existingCLCAddress("index"),
    adapter = existingCLCAddress("GnosisVoucherAdapter");
  const registry = new Contract(index, CLC_INDEX_ABI, provider);
  const result: unknown[] = [];
  for (const name of ["greenGoodsToken", "techAndSunToken"]) {
    const address = existingCLCAddress(name),
      token = new Contract(address, CLC_TOKEN_ABI, provider);
    const owner = await token.owner();
    const reserve = name === "greenGoodsToken" ? pilot.endpointOwner : "0x9BE5f0D6B95Ea3735df71023F5dFED53b4c1aABf";
    result.push({
      address,
      owner,
      implementation: await provider.getStorage(address, SLOT),
      supply: String(await token.totalSupply()),
      minted: String(await token.totalMinted()),
      burned: String(await token.totalBurned()),
      reserve: String(await token.balanceOf(reserve)),
      stock: String(await token.balanceOf(pool)),
      testSafeBalance: String(await token.balanceOf(plan.safe)),
      testPoolBalance: String(await token.balanceOf(plan.addresses.pool)),
      allowance: String(await token.allowance(reserve, adapter)),
      registered: await registry.have(address),
    });
  }
  const endpoint = new Contract(
    adapter,
    [
      "function assetAuthorizations(address,address) view returns(address,bool)",
      "function owner() view returns(address)",
      "function paused() view returns(bool)",
    ],
    provider,
  );
  result.push({
    registryEntries: String(await registry.entryCount()),
    adapterOwner: await endpoint.owner(),
    adapterPaused: await endpoint.paused(),
    fixtureAdmissions: await Promise.all(
      plan.assets.map(async (a) => ({
        token: a.token,
        registered: await registry.have(a.token),
        adapterAuthorization: [...(await endpoint.assetAuthorizations(plan.safe, a.token))].map(String),
      })),
    ),
  });
  for (const address of ["0xedfd6ba544035c6f35f395eb93395fa7f872d208", "0x9BE5f0D6B95Ea3735df71023F5dFED53b4c1aABf"]) {
    const safe = new Contract(address, AIYELOJA_SAFE_ABI, provider);
    result.push({
      safe: address,
      owners: [...(await safe.getOwners())],
      threshold: String(await safe.getThreshold()),
      nonce: String(await safe.nonce()),
    });
  }
  return { hash: voucherDigest(result), state: result };
}
export async function verifyAiyelojaDeployment(provider: JsonRpcProvider, plan: CLCAiyelojaPlan, initial = false) {
  const factory = new Contract(CLC_DEPENDENCIES.factory.address, CLC_FACTORY_ABI, provider);
  for (const tx of plan.transactions) {
    aiyelojaEqual(await provider.getCode(tx.address), getCLCProxyRuntime(), "proxy runtime");
    aiyelojaEqual(
      `0x${(await provider.getStorage(tx.address, SLOT)).slice(-40)}`,
      tx.implementation,
      "proxy implementation",
    );
    aiyelojaEqual(await factory.adminOf(tx.address), plan.safe, "Safe proxy administration");
    const contract = new Contract(tx.address, CLC_TOKEN_ABI, provider);
    aiyelojaEqual(await contract.owner(), plan.safe, "Safe contract ownership");
    if (tx.component.startsWith("fixture:")) {
      const asset = plan.assets.find((a) => a.token === tx.address)!;
      aiyelojaEqual(await contract.name(), asset.name, "fixture name");
      aiyelojaEqual(await contract.symbol(), asset.symbol, "fixture symbol");
      aiyelojaEqual(await contract.decimals(), 6, "fixture decimals");
      aiyelojaEqual(await contract.expired(), false, "fixture expiry");
      aiyelojaEqual(await contract.isWriter(plan.safe), true, "Safe mint authority");
      aiyelojaEqual(await contract.isWriter(tx.from), false, "no deployer mint authority");
      aiyelojaEqual(await contract.isWriter(plan.automation), false, "automation acts through Safe");
      if (initial) aiyelojaEqual(await contract.totalSupply(), 0, "issuance waits for Safe");
    }
  }
  const pool = new Contract(plan.addresses.pool, CLC_POOL_ABI, provider);
  for (const [method, key] of [
    ["tokenRegistry", "index"],
    ["tokenLimiter", "limiter"],
    ["quoter", "quoter"],
    ["feePolicy", "feePolicy"],
    ["protocolFeeController", "protocolFee"],
  ] as const)
    aiyelojaEqual(await pool[method](), plan.addresses[key], `pool ${method}`);
  aiyelojaEqual(await pool.name(), "Aiyeloja Test Exchange Pool", "pool name");
  aiyelojaEqual(await pool.symbol(), "AYTP", "pool symbol");
  aiyelojaEqual(await pool.feeAddress(), plan.safe, "fee recipient");
  aiyelojaEqual(await pool.feesDecoupled(), true, "separate fees");
  aiyelojaEqual(
    await new Contract(plan.addresses.feePolicy, CLC_FEE_POLICY_ABI, provider).getDefaultFee(),
    0,
    "zero pool fee",
  );
  const protocol = new Contract(plan.addresses.protocolFee, CLC_PROTOCOL_FEE_ABI, provider);
  aiyelojaEqual(await protocol.getProtocolFee(), 0, "zero protocol fee");
  aiyelojaEqual(await protocol.getProtocolFeeRecipient(), plan.safe, "protocol fee recipient");
  if (initial)
    aiyelojaEqual(
      await new Contract(plan.addresses.index, CLC_INDEX_ABI, provider).entryCount(),
      0,
      "listing waits for Safe",
    );
}
export async function verifyAiyelojaActivation(provider: JsonRpcProvider, plan: CLCAiyelojaPlan) {
  await verifyAiyelojaDeployment(provider, plan);
  const index = new Contract(plan.addresses.index, CLC_INDEX_ABI, provider),
    limiter = new Contract(plan.addresses.limiter, CLC_LIMITER_ABI, provider);
  const pool = new Contract(plan.addresses.pool, CLC_POOL_ABI, provider);
  aiyelojaEqual(await index.entryCount(), plan.assets.length, "only fixture listings");
  aiyelojaEqual(await pool.isSealed(31), true, "pool parameter seal");
  const rows = [];
  for (const asset of plan.assets) {
    const token = new Contract(asset.token, CLC_TOKEN_ABI, provider);
    aiyelojaEqual(await token.totalSupply(), asset.supply, "fixture supply");
    aiyelojaEqual(await token.totalMinted(), asset.supply, "fixture minted once");
    aiyelojaEqual(await token.balanceOf(plan.addresses.pool), asset.inventory, "pool stock");
    aiyelojaEqual(
      await token.balanceOf(plan.safe),
      BigInt(asset.supply) - BigInt(asset.inventory) - BigInt(asset.automationBalance),
      "Safe reserve",
    );
    aiyelojaEqual(await token.balanceOf(plan.automation), asset.automationBalance, "automation test balance");
    aiyelojaEqual(await token.allowance(plan.safe, plan.addresses.pool), 0, "consumed finite funding allowance");
    aiyelojaEqual(await index.have(asset.token), true, "fixture admission");
    aiyelojaEqual(await limiter.limitOf(asset.token, plan.addresses.pool), asset.holdingCap, "holding cap");
    rows.push({
      token: asset.token,
      supply: asset.supply,
      inventory: asset.inventory,
      reserve: String(await token.balanceOf(plan.safe)),
    });
    for (const other of plan.assets.filter((a) => a.token !== asset.token))
      aiyelojaEqual(await pool.getQuote(asset.token, other.token, 1_000_000), 1_000_000, "1:1 quote");
  }
  for (const name of ["greenGoodsToken", "techAndSunToken"])
    aiyelojaEqual(await index.have(existingCLCAddress(name)), false, "production asset excluded");
  return rows;
}
