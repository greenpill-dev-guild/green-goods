import { concat, getAddress, getCreate2Address, Interface, isAddress, MaxUint256, toBeHex, ZeroAddress } from "ethers";
import { CLC_POOL_COMPONENTS, type CLCGardenDeployment, type CLCGardenPoolComponent } from "./clc-garden-release";
import {
  CLC_DEPENDENCIES,
  CLC_FACTORY_ABI,
  CLC_FACTORY_INIT_CODE_HASH,
  CLC_INDEX_ABI,
  CLC_LIMITER_ABI,
  CLC_QUOTER_ABI,
  CLC_FEE_POLICY_ABI,
  CLC_PROTOCOL_FEE_ABI,
  CLC_POOL_ABI,
  CLC_TOKEN_ABI,
} from "./clc-release";
import { voucherDigest } from "./voucher-release";

export const AIYELOJA_TEST_SAFE = getAddress("0xdeB7d1990a643Aa4954ff179e9683Ed4693A955c");
export const AIYELOJA_GARDEN = getAddress("0xF7b892886998DAe960D64a9db488336684F137A0");
export const AIYELOJA_MULTISEND = getAddress("0x9641d764fc13c8B624c04430C7356C1C7C8102e2");
// Safe deployments v1.4.1, verified on Gnosis; match the Transaction Builder SDK version.
export const AIYELOJA_MULTISEND_RUNTIME_HASH = "0xecd5bd14a08c5d2122379900b2f272bdf107a7e92423c10dd5fe3254386c9939";
export const AIYELOJA_TOKEN_ABI = [...CLC_TOKEN_ABI, "function transfer(address,uint256) returns(bool)"];
export const AIYELOJA_SWAP_ABI = [
  ...CLC_POOL_ABI,
  "function withdraw(address tokenOut,address tokenIn,uint256 amountIn,address recipient,uint256 minAmountOut,uint256 deadline) returns(uint256)",
];
export interface CLCAiyelojaManifest {
  schemaVersion: 4;
  kind: "AIYELOJA_TEST_POOL";
  testOnly: true;
  releaseId: string;
  chainId: 100;
  garden: string;
  safe: string;
  safeOwners: string[];
  safeNonce: number;
  deployer: string;
  nonce: number;
  automation: string;
  tokens: {
    id: string;
    kind: "garden" | "member-fixture";
    name: string;
    symbol: string;
    supply: string;
    inventory: string;
    holdingCap: string;
    automationBalance: string;
  }[];
}
export type AiyelojaDeployment = Omit<CLCGardenDeployment, "component"> & { component: string };
export interface AiyelojaCall {
  to: string;
  value: "0";
  data: string;
  operation: 0;
}
export interface AiyelojaBatch {
  name: string;
  nonce: number;
  safe: string;
  chainId: 100;
  calls: AiyelojaCall[];
}
export interface CLCAiyelojaPlan {
  schemaVersion: 4;
  kind: "AIYELOJA_TEST_POOL_PREPARATION";
  testOnly: true;
  releaseId: string;
  sourceCommit: string;
  manifestHash: string;
  chainId: 100;
  garden: string;
  safe: string;
  safeOwners: string[];
  automation: string;
  safeBatchExecutor: { version: "1.4.1"; address: string; runtimeHash: string; operation: 1 };
  addresses: Record<CLCGardenPoolComponent, string>;
  assets: (CLCAiyelojaManifest["tokens"][number] & { token: string; owner: string; admin: string })[];
  transactions: AiyelojaDeployment[];
  batches: AiyelojaBatch[];
  appActivationIncluded: false;
  liveBroadcast: false;
}
function object(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== [...keys].sort().join()
  )
    throw new Error(`Invalid ${label} fields`);
  return value as Record<string, unknown>;
}
function address(value: unknown): string {
  if (typeof value !== "string" || !isAddress(value) || getAddress(value) === ZeroAddress)
    throw new Error("Invalid test pool address");
  return getAddress(value);
}
function units(value: unknown, zero = false): bigint {
  if (
    typeof value !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(value) ||
    BigInt(value) >= MaxUint256 ||
    (!zero && BigInt(value) === 0n)
  )
    throw new Error("Invalid test voucher amount");
  return BigInt(value);
}
/** Test fixtures have collective custody. They are never represented as independently issued member assets. */
export function inspectCLCAiyelojaManifest(value: unknown): CLCAiyelojaManifest {
  const m = object(
    value,
    [
      "schemaVersion",
      "kind",
      "testOnly",
      "releaseId",
      "chainId",
      "garden",
      "safe",
      "safeOwners",
      "safeNonce",
      "deployer",
      "nonce",
      "automation",
      "tokens",
    ],
    "Aiyeloja manifest",
  );
  if (
    m.schemaVersion !== 4 ||
    m.kind !== "AIYELOJA_TEST_POOL" ||
    m.testOnly !== true ||
    m.chainId !== 100 ||
    typeof m.releaseId !== "string" ||
    !/^aiyeloja-test-[a-z0-9-]{1,60}$/.test(m.releaseId) ||
    address(m.safe) !== AIYELOJA_TEST_SAFE ||
    address(m.garden) !== AIYELOJA_GARDEN
  )
    throw new Error("Preserve the separate Aiyeloja test Safe and existing garden");
  const owners = Array.isArray(m.safeOwners) ? m.safeOwners.map(address) : [];
  if (owners.length < 2 || new Set(owners).size !== owners.length || !owners.includes(address(m.automation)))
    throw new Error("Automation must be a reviewed test Safe owner; owners must be unique");
  const deployer = address(m.deployer);
  if (deployer === AIYELOJA_TEST_SAFE || deployer === AIYELOJA_GARDEN) throw new Error("Invalid dedicated deployer");
  for (const key of ["safeNonce", "nonce"])
    if (!Number.isSafeInteger(m[key]) || Number(m[key]) < 0 || Number(m[key]) > Number.MAX_SAFE_INTEGER - 64)
      throw new Error("Invalid test pool nonce");
  if (!Array.isArray(m.tokens) || m.tokens.length !== 3) throw new Error("Test pool needs garden and member fixtures");
  const ids = new Set<string>(),
    symbols = new Set<string>();
  let gardens = 0;
  for (const raw of m.tokens) {
    const token = object(
      raw,
      ["id", "kind", "name", "symbol", "supply", "inventory", "holdingCap", "automationBalance"],
      "test token",
    );
    if (
      typeof token.id !== "string" ||
      !/^[a-z][a-z0-9-]{0,39}$/.test(token.id) ||
      ids.has(token.id) ||
      typeof token.name !== "string" ||
      !/^Aiyeloja Test [\x20-\x7e]{1,70}$/.test(token.name) ||
      typeof token.symbol !== "string" ||
      !/^AYT[A-Z0-9]{1,8}$/.test(token.symbol) ||
      symbols.has(token.symbol) ||
      !["garden", "member-fixture"].includes(String(token.kind))
    )
      throw new Error("Invalid or duplicate test fixture identity");
    ids.add(token.id);
    symbols.add(token.symbol);
    if (token.kind === "garden") gardens++;
    const supply = units(token.supply),
      inventory = units(token.inventory),
      cap = units(token.holdingCap),
      distribution = units(token.automationBalance);
    if (cap <= inventory || supply < inventory + distribution || supply > 100n * 10n ** 6n || cap > supply)
      throw new Error("Test-only supply is capped at 100; reserve and holding-cap headroom are required");
  }
  if (gardens !== 1) throw new Error("Exactly one garden test voucher required");
  return structuredClone(value) as CLCAiyelojaManifest;
}
const encode = (abi: readonly string[], name: string, args: unknown[]) =>
  new Interface(abi).encodeFunctionData(name, args);
export function buildCLCAiyelojaPlan(value: unknown, sourceCommit: string): CLCAiyelojaPlan {
  const m = inspectCLCAiyelojaManifest(value);
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("Invalid committed release revision");
  const safe = getAddress(m.safe),
    deployer = getAddress(m.deployer);
  const saltFor = (component: string) =>
    `0x${deployer.slice(2).toLowerCase()}${voucherDigest({ releaseId: m.releaseId, component, safe }).slice(0, 24)}`;
  const predict = (component: string) =>
    getCreate2Address(CLC_DEPENDENCIES.factory.address, saltFor(component), CLC_FACTORY_INIT_CODE_HASH);
  const addresses = Object.fromEntries(
    CLC_POOL_COMPONENTS.map((key) => [key, predict(key)]),
  ) as CLCAiyelojaPlan["addresses"];
  const transactions: AiyelojaDeployment[] = [];
  const add = (component: string, implementation: string, initializer: string) => {
    const salt = saltFor(component);
    transactions.push({
      component,
      chainId: 100,
      from: deployer,
      nonce: m.nonce + transactions.length,
      address: predict(component),
      to: CLC_DEPENDENCIES.factory.address,
      value: "0",
      salt,
      implementation,
      admin: safe,
      initializer,
      data: encode(CLC_FACTORY_ABI, "deployDeterministicAndCall", [implementation, safe, salt, initializer]),
    });
  };
  const initializers = {
    index: encode(CLC_INDEX_ABI, "initialize", [safe, [], []]),
    limiter: encode(CLC_LIMITER_ABI, "initialize", [safe]),
    quoter: encode(CLC_QUOTER_ABI, "initialize", [safe]),
    feePolicy: encode(CLC_FEE_POLICY_ABI, "initialize", [safe, 0]),
    protocolFee: encode(CLC_PROTOCOL_FEE_ABI, "initialize", [safe, 0, safe]),
    pool: encode(CLC_POOL_ABI, "initialize", [
      "Aiyeloja Test Exchange Pool",
      "AYTP",
      6,
      safe,
      addresses.feePolicy,
      safe,
      addresses.index,
      addresses.limiter,
      addresses.quoter,
      true,
      addresses.protocolFee,
    ]),
  };
  for (const key of CLC_POOL_COMPONENTS) add(key, CLC_DEPENDENCIES[key].address, initializers[key]);
  const assets = m.tokens.map((token) => {
    const component = `fixture:${token.id}`;
    add(
      component,
      CLC_DEPENDENCIES.token.address,
      encode(CLC_TOKEN_ABI, "initialize", [token.name, token.symbol, 6, safe, 0]),
    );
    return { ...token, token: predict(component), owner: safe, admin: safe };
  });
  const configuration: AiyelojaCall[] = [],
    funding: AiyelojaCall[] = [],
    distribution: AiyelojaCall[] = [];
  const call = (calls: AiyelojaCall[], to: string, abi: readonly string[], method: string, args: unknown[]) =>
    calls.push({ to, value: "0", data: encode(abi, method, args), operation: 0 });
  for (const asset of assets) {
    call(configuration, asset.token, CLC_TOKEN_ABI, "mintTo", [safe, asset.supply]);
    call(configuration, addresses.index, CLC_INDEX_ABI, "register", [asset.token]);
    call(configuration, addresses.limiter, CLC_LIMITER_ABI, "setLimitFor", [
      asset.token,
      addresses.pool,
      asset.holdingCap,
    ]);
    call(configuration, addresses.quoter, CLC_QUOTER_ABI, "setPriceIndexValue", [asset.token, 1_000_000]);
    call(funding, asset.token, CLC_TOKEN_ABI, "approve", [addresses.pool, asset.inventory]);
    call(funding, addresses.pool, CLC_POOL_ABI, "deposit", [asset.token, asset.inventory]);
    call(distribution, asset.token, AIYELOJA_TOKEN_ABI, "transfer", [m.automation, asset.automationBalance]);
  }
  call(configuration, addresses.pool, CLC_POOL_ABI, "seal", [31]);
  return {
    schemaVersion: 4,
    kind: "AIYELOJA_TEST_POOL_PREPARATION",
    testOnly: true,
    releaseId: m.releaseId,
    sourceCommit,
    manifestHash: voucherDigest(m),
    chainId: 100,
    garden: m.garden,
    safe,
    safeOwners: m.safeOwners.map(getAddress),
    automation: getAddress(m.automation),
    safeBatchExecutor: {
      version: "1.4.1",
      address: AIYELOJA_MULTISEND,
      runtimeHash: AIYELOJA_MULTISEND_RUNTIME_HASH,
      operation: 1,
    },
    addresses,
    assets,
    transactions,
    batches: [
      { name: "01-configure-and-mint", nonce: m.safeNonce, safe, chainId: 100, calls: configuration },
      { name: "02-fund-pool", nonce: m.safeNonce + 1, safe, chainId: 100, calls: funding },
      { name: "03-distribute-test-balances", nonce: m.safeNonce + 2, safe, chainId: 100, calls: distribution },
    ],
    appActivationIncluded: false,
    liveBroadcast: false,
  };
}
export function validateCLCAiyelojaPlan(
  plan: unknown,
  manifest: unknown,
  revision: string,
): asserts plan is CLCAiyelojaPlan {
  if (voucherDigest(plan) !== voucherDigest(buildCLCAiyelojaPlan(manifest, revision)))
    throw new Error("Aiyeloja release plan mismatch");
}
export function aiyelojaSafeUpload(batch: AiyelojaBatch) {
  return {
    version: "1.0",
    chainId: "100",
    createdAt: 0,
    meta: {
      name: `Aiyeloja TEST: ${batch.name}; Safe nonce ${batch.nonce}`,
      description: "PRD-1481. Test vouchers only. Review the Safe nonce against the packet before signing.",
      txBuilderVersion: "1.18.0",
      createdFromSafeAddress: batch.safe,
    },
    transactions: batch.calls.map(({ to, value, data }) => ({
      to,
      value,
      data,
      contractMethod: null,
      contractInputsValues: null,
    })),
  };
}
export function aiyelojaMultiSendData(batch: AiyelojaBatch): string {
  const packed = concat(
    batch.calls.map((call) =>
      concat(["0x00", call.to, toBeHex(0, 32), toBeHex((call.data.length - 2) / 2, 32), call.data]),
    ),
  );
  return encode(["function multiSend(bytes)"], "multiSend", [packed]);
}
