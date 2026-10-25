import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { concat, getAddress, getCreate2Address, getCreateAddress, Interface, isAddress, ZeroAddress } from "ethers";
import type { VoucherArtifact } from "./voucher-release";

// Published CLC docs pin ce090fd3d5a7493c726fb939da39af15ef1c9d7c; no upstream source import.
export const CLC_DEPENDENCIES = {
  factory: {
    address: "0xB286994c648F98fD3a3BA6C43934828a5b88162b",
    runtimeHash: "0x2e06e9a024d7bd35356833e6fcb9f34c1fbdae8bbd91da3bc55e4cc2ba4d1230",
  },
  token: {
    address: "0x34445d13F112A11f72C1d353a7dcdc407F3df2d8",
    runtimeHash: "0x074980d5e0e6bfb3afd2faa9f828cf65d65ae7ed568f65b2623fa61190e95d91",
  },
  pool: {
    address: "0x9e694D342Cab02e295262B2290b0E64A0334160D",
    runtimeHash: "0xc353aac7dd541d1c50c7eeb20a15a44ea9f93524f23a26217a557667ddd87847",
  },
  index: {
    address: "0x0CEB18BA6562D3227717D98c044A5849bE8362EF",
    runtimeHash: "0x7d87c5eb290d28f0961269d99ccb278992b7a1e1ad358abb35156a80bc7f3db5",
  },
  limiter: {
    address: "0x258AAd6c933F70D7F071E112800a41Fb60434048",
    runtimeHash: "0x4703592f66925654d50872a319602d2ec144698515abc9e4df00c36d5b4a3d32",
  },
  quoter: {
    address: "0x0B0986c0E580377389337C453Cc65A3933511165",
    runtimeHash: "0x6b1691764731912392f3c3c24121d3d3fc26e844fa464d93f323e4205f0ac273",
  },
  feePolicy: {
    address: "0x1b97FfFAF2D2e16C8F7de6826F4F658dc898E5b6",
    runtimeHash: "0x7fcdb49bc3a1a63a41a22e7646e46a17d347c2aa790dbc1f524f8c50ddc03b3c",
  },
  protocolFee: {
    address: "0x302E6d520e7D7AeFceA4813e456234B5daA23B4d",
    runtimeHash: "0xf441076998949ba0daa400a3b16613691260673679d12087fe39ddb19c62c1d9",
  },
} as const;
// Read from the pinned deployed factory on Gnosis block 48,898,608.
export const CLC_FACTORY_INIT_CODE_HASH = "0x1fa551e9b261b3a9568d5ec12f9d6028366575ac46f6d66f918abeebb2242c6b";
export const CLC_TIMELOCK_SOURCE =
  "lib/tokenbound/lib/openzeppelin-contracts/contracts/governance/TimelockController.sol";
export const CLC_FACTORY_ABI = [
  "function deployDeterministicAndCall(address implementation,address admin,bytes32 salt,bytes data) payable returns(address)",
  "function predictDeterministicAddress(bytes32 salt) view returns(address)",
  "function initCodeHash() pure returns(bytes32)",
  "function adminOf(address proxy) view returns(address)",
];
export const CLC_TOKEN_ABI = [
  "function initialize(string name,string symbol,uint8 decimals,address owner,uint256 expiresAt)",
  "function owner() view returns(address)",
  "function isWriter(address) view returns(bool)",
  "function name() view returns(string)",
  "function symbol() view returns(string)",
  "function decimals() view returns(uint8)",
  "function totalSupply() view returns(uint256)",
  "function totalMinted() view returns(uint256)",
  "function totalBurned() view returns(uint256)",
  "function expired() view returns(bool)",
  "function balanceOf(address) view returns(uint256)",
  "function allowance(address,address) view returns(uint256)",
  "function approve(address,uint256) returns(bool)",
  "function mintTo(address,uint256)",
];
export const CLC_POOL_ABI = [
  "function initialize(string name,string symbol,uint8 decimals,address owner,address feePolicy,address feeAddress,address tokenRegistry,address tokenLimiter,address quoter,bool feesDecoupled,address protocolFeeController)",
  "function owner() view returns(address)",
  "function name() view returns(string)",
  "function symbol() view returns(string)",
  "function decimals() view returns(uint8)",
  "function feePolicy() view returns(address)",
  "function feeAddress() view returns(address)",
  "function tokenRegistry() view returns(address)",
  "function tokenLimiter() view returns(address)",
  "function quoter() view returns(address)",
  "function protocolFeeController() view returns(address)",
  "function feesDecoupled() view returns(bool)",
  "function fees(address) view returns(uint256)",
  "function deposit(address,uint256) returns(uint256)",
  "function seal(uint8)",
  "function isSealed(uint8) view returns(bool)",
  "function getQuote(address,address,uint256) view returns(uint256)",
];
export const CLC_INDEX_ABI = [
  "function initialize(address,address[],bytes32[])",
  "function owner() view returns(address)",
  "function register(address)",
  "function have(address) view returns(bool)",
  "function entryCount() view returns(uint256)",
  "function identifierCount() view returns(uint256)",
  "function isWriter(address) view returns(bool)",
];
export const CLC_LIMITER_ABI = [
  "function initialize(address)",
  "function owner() view returns(address)",
  "function isWriter(address) view returns(bool)",
  "function setLimitFor(address,address,uint256)",
  "function limitOf(address,address) view returns(uint256)",
];
export const CLC_QUOTER_ABI = [
  "function initialize(address)",
  "function owner() view returns(address)",
  "function setPriceIndexValue(address,uint256)",
  "function valueFor(address,address,uint256) view returns(uint256)",
  "function reverseValueFor(address,address,uint256) view returns(uint256)",
];
export const CLC_FEE_POLICY_ABI = [
  "function initialize(address,uint256)",
  "function owner() view returns(address)",
  "function getFee(address,address) view returns(uint256)",
  "function getDefaultFee() view returns(uint256)",
];
export const CLC_PROTOCOL_FEE_ABI = [
  "function initialize(address,uint256,address)",
  "function owner() view returns(address)",
  "function getProtocolFee() view returns(uint256)",
  "function getProtocolFeeRecipient() view returns(address)",
  "function isActive() view returns(bool)",
];
export const CLC_TIMELOCK_ABI = [
  "constructor(uint256 minDelay,address[] proposers,address[] executors,address admin)",
  "function getMinDelay() view returns(uint256)",
  "function hasRole(bytes32,address) view returns(bool)",
  "function TIMELOCK_ADMIN_ROLE() view returns(bytes32)",
  "function PROPOSER_ROLE() view returns(bytes32)",
  "function EXECUTOR_ROLE() view returns(bytes32)",
  "function CANCELLER_ROLE() view returns(bytes32)",
];
const GREEN_GOODS_SAFE = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19";
export type CLCIssuer = "greenGoods" | "techAndSun";
export interface CLCIssuerInputs {
  name: string;
  symbol: string;
  terms: { reference: string | null; digest: string | null };
  capacityConfirmed: boolean;
  sourceIssuerAuthority: string | null;
  initialSupply: string;
  poolInventory: string;
  poolHoldingCap: string;
  adapterAllowance: string;
}
export interface CLCPilotManifest {
  schemaVersion: 1;
  releaseId: string;
  chainId: 100;
  deployer: string | null;
  nonce: number | null;
  greenGoodsSafe: string;
  techAndSunSafe: string | null;
  decimals: 6;
  expiresAt: 0;
  minimumUpgradeDelay: 0;
  earnedAdapter: string | null;
  issuers: Record<CLCIssuer, CLCIssuerInputs>;
  pool: { name: string; symbol: string; priceIndex: string; poolFee: string; protocolFee: string; feesDecoupled: true };
}
export const CLC_COMPONENTS = [
  "greenGoodsTimelock",
  "techAndSunTimelock",
  "greenGoodsToken",
  "techAndSunToken",
  "index",
  "limiter",
  "quoter",
  "feePolicy",
  "protocolFee",
  "pool",
] as const;
export type CLCComponent = (typeof CLC_COMPONENTS)[number];
export interface CLCDeploymentTransaction {
  component: CLCComponent;
  chainId: 100;
  kind: "timelock" | "proxy";
  from: string;
  nonce: number;
  address: string;
  to: string | null;
  value: "0";
  data: string;
  salt?: string;
  implementation?: string;
  admin?: string;
  initializer?: string;
}
export interface CLCReviewTransaction {
  chainId: 100;
  from: string;
  to: string | null;
  value: "0";
  operation: string;
  data: string | null;
  executable: boolean;
  missing: string[];
  reviewOnly: true;
}
export interface CLCPilotPlan {
  schemaVersion: 1;
  kind: "CLC_PILOT_PREPARATION";
  releaseId: string;
  sourceCommit: string;
  manifestHash: string;
  artifactHash: string;
  addresses: Record<CLCComponent, string>;
  transactions: CLCDeploymentTransaction[];
  configurationTransactions: CLCReviewTransaction[];
  issuanceTransactions: CLCReviewTransaction[];
  activationMissing: string[];
  initialState: { tokenSupply: "0"; poolInventory: "0"; registeredTokens: []; defaultHoldingLimit: "0" };
  activationIncluded: false;
  liveBroadcast: false;
}
function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function object(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Unknown ${label}.${key}`);
  for (const key of keys) if (!Object.hasOwn(value, key)) throw new Error(`Missing ${label}.${key}`);
  return value as Record<string, unknown>;
}
function address(value: unknown, label: string, missing: string[]): void {
  if (value === null) {
    missing.push(label);
    return;
  }
  if (typeof value !== "string" || !isAddress(value) || BigInt(value) <= 1n) throw new Error(`Invalid ${label}`);
}
function amount(value: unknown, label: string, zero = false): bigint {
  if (
    typeof value !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(value) ||
    BigInt(value) < (zero ? 0n : 1n) ||
    BigInt(value) >= 1n << 256n
  )
    throw new Error(`Invalid ${label}`);
  return BigInt(value);
}
function label(value: unknown, field: string, symbol = false): void {
  if (
    typeof value !== "string" ||
    !(symbol ? /^[A-Z][A-Z0-9]{1,11}$/ : /^[\x20-\x7e]{1,100}$/).test(value) ||
    value.trim() !== value
  )
    throw new Error(`Invalid ${field}`);
}
export function inspectCLCPilotManifest(value: unknown): {
  manifest: CLCPilotManifest;
  deploymentMissing: string[];
  activationMissing: string[];
} {
  const m = object(
    value,
    [
      "schemaVersion",
      "releaseId",
      "chainId",
      "deployer",
      "nonce",
      "greenGoodsSafe",
      "techAndSunSafe",
      "decimals",
      "expiresAt",
      "minimumUpgradeDelay",
      "earnedAdapter",
      "issuers",
      "pool",
    ],
    "manifest",
  );
  if (
    m.schemaVersion !== 1 ||
    typeof m.releaseId !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(m.releaseId) ||
    m.chainId !== 100 ||
    m.decimals !== 6 ||
    m.expiresAt !== 0 ||
    m.minimumUpgradeDelay !== 0
  )
    throw new Error("Invalid CLC pilot identity or policy");
  if (m.greenGoodsSafe !== GREEN_GOODS_SAFE) throw new Error("Preserve existing Green Goods pool and reserve Safe");
  const deploymentMissing: string[] = [];
  const activationMissing: string[] = [];
  address(m.deployer, "deployer", deploymentMissing);
  if (m.nonce === null) deploymentMissing.push("nonce");
  else if (
    !Number.isSafeInteger(m.nonce) ||
    (m.nonce as number) < 0 ||
    (m.nonce as number) > Number.MAX_SAFE_INTEGER - 9
  )
    throw new Error("Invalid deployment nonce");
  address(m.techAndSunSafe, "techAndSunSafe", deploymentMissing);
  if (m.techAndSunSafe !== null && getAddress(m.techAndSunSafe as string) === GREEN_GOODS_SAFE)
    throw new Error("Duplicate issuer Safe");
  if (
    m.deployer !== null &&
    [GREEN_GOODS_SAFE, m.techAndSunSafe === null ? null : getAddress(m.techAndSunSafe as string)].includes(
      getAddress(m.deployer as string),
    )
  )
    throw new Error("Native deployment sender must be separate from issuer Safes");
  address(m.earnedAdapter, "earnedAdapter", activationMissing);
  const issuers = object(m.issuers, ["greenGoods", "techAndSun"], "issuers");
  const symbols = new Set<string>();
  for (const key of ["greenGoods", "techAndSun"] as const) {
    const prefix = `issuers.${key}`;
    const i = object(
      issuers[key],
      [
        "name",
        "symbol",
        "terms",
        "capacityConfirmed",
        "sourceIssuerAuthority",
        "initialSupply",
        "poolInventory",
        "poolHoldingCap",
        "adapterAllowance",
      ],
      prefix,
    );
    label(i.name, `${prefix}.name`);
    label(i.symbol, `${prefix}.symbol`, true);
    if (symbols.has(i.symbol as string)) throw new Error("Duplicate issuer token symbol");
    symbols.add(i.symbol as string);
    const terms = object(i.terms, ["reference", "digest"], `${prefix}.terms`);
    if (terms.reference === null) activationMissing.push(`${prefix}.terms.reference`);
    else {
      if (typeof terms.reference !== "string") throw new Error(`Invalid ${prefix}.terms.reference`);
      const reference = new URL(terms.reference);
      if (reference.protocol !== "https:" || reference.username || reference.password)
        throw new Error(`Invalid ${prefix}.terms.reference`);
    }
    if (terms.digest === null) activationMissing.push(`${prefix}.terms.digest`);
    else if (typeof terms.digest !== "string" || !/^0x[0-9a-f]{64}$/.test(terms.digest))
      throw new Error(`Invalid ${prefix}.terms.digest`);
    if (typeof i.capacityConfirmed !== "boolean") throw new Error(`Invalid ${prefix}.capacityConfirmed`);
    if (!i.capacityConfirmed) activationMissing.push(`${prefix}.capacityConfirmed`);
    address(i.sourceIssuerAuthority, `${prefix}.sourceIssuerAuthority`, activationMissing);
    const supply = amount(i.initialSupply, `${prefix}.initialSupply`);
    const inventory = amount(i.poolInventory, `${prefix}.poolInventory`);
    const cap = amount(i.poolHoldingCap, `${prefix}.poolHoldingCap`);
    const allowance = amount(i.adapterAllowance, `${prefix}.adapterAllowance`);
    if (
      supply !== 20_000_000n ||
      inventory > supply ||
      allowance > supply - inventory ||
      cap > supply ||
      cap < inventory
    )
      throw new Error(`Invalid ${prefix} supply, inventory, cap or finite allowance`);
    if (cap <= inventory) activationMissing.push(`${prefix}.poolHeadroom`);
  }
  const pool = object(m.pool, ["name", "symbol", "priceIndex", "poolFee", "protocolFee", "feesDecoupled"], "pool");
  label(pool.name, "pool.name");
  label(pool.symbol, "pool.symbol", true);
  if (
    amount(pool.priceIndex, "pool.priceIndex") !== 1_000_000n ||
    amount(pool.poolFee, "pool.poolFee", true) !== 0n ||
    amount(pool.protocolFee, "pool.protocolFee", true) !== 0n ||
    pool.feesDecoupled !== true
  )
    throw new Error("Unsupported pilot pool fee or exchange policy");
  return { manifest: value as CLCPilotManifest, deploymentMissing, activationMissing };
}
export function loadCLCPilotManifest(file: string): CLCPilotManifest {
  return inspectCLCPilotManifest(JSON.parse(readFileSync(file, "utf8"))).manifest;
}
export function loadCLCTimelockArtifact(out: string): VoucherArtifact {
  return JSON.parse(readFileSync(path.join(out, "TimelockController.sol", "TimelockController.json"), "utf8"));
}
export function inspectCLCTimelockArtifact(a: VoucherArtifact): string {
  const s = a.metadata.settings;
  if (
    !/^0\.8\.28\+/.test(a.metadata.compiler.version) ||
    !s.optimizer.enabled ||
    s.optimizer.runs !== 1 ||
    s.viaIR !== true ||
    s.evmVersion !== "cancun" ||
    JSON.stringify(s.compilationTarget) !== JSON.stringify({ [CLC_TIMELOCK_SOURCE]: "TimelockController" }) ||
    Object.keys(s.libraries ?? {}).length
  )
    throw new Error("Timelock artifact must use reviewed production settings");
  for (const b of [a.bytecode, a.deployedBytecode])
    if (
      !/^(0x)?[0-9a-fA-F]+$/.test(b.object) ||
      b.object.replace(/^0x/, "").length % 2 ||
      Object.keys(b.linkReferences ?? {}).length
    )
      throw new Error("Invalid unlinked timelock bytecode");
  if (a.deployedBytecode.object.replace(/^0x/, "").length / 2 > 24576)
    throw new Error("Timelock runtime exceeds EIP-170");
  return digest(a);
}
export function buildCLCPilotPlan(value: unknown, artifact: VoucherArtifact, sourceCommit: string): CLCPilotPlan {
  const { manifest: m, deploymentMissing, activationMissing } = inspectCLCPilotManifest(value);
  if (deploymentMissing.length || m.deployer === null || m.nonce === null || m.techAndSunSafe === null)
    throw new Error(`Missing CLC deployment inputs: ${deploymentMissing.join(", ")}`);
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error("Invalid source revision");
  const artifactHash = inspectCLCTimelockArtifact(artifact);
  const manifestHash = digest(m);
  const deployer = getAddress(m.deployer);
  const nonce = m.nonce;
  const techAndSunSafe = getAddress(m.techAndSunSafe);
  const addresses = {} as Record<CLCComponent, string>;
  addresses.greenGoodsTimelock = getCreateAddress({ from: deployer, nonce });
  addresses.techAndSunTimelock = getCreateAddress({ from: deployer, nonce: nonce + 1 });
  const salts = {} as Record<CLCComponent, string>;
  for (const component of CLC_COMPONENTS.slice(2)) {
    salts[component] =
      `0x${deployer.slice(2).toLowerCase()}${digest({ releaseId: m.releaseId, component, manifestHash }).slice(0, 24)}`;
    addresses[component] = getCreate2Address(
      CLC_DEPENDENCIES.factory.address,
      salts[component],
      CLC_FACTORY_INIT_CODE_HASH,
    );
  }
  const encode = (abi: string[], method: string, args: unknown[]) =>
    new Interface(abi).encodeFunctionData(method, args);
  const safeFor = (issuer: CLCIssuer) => (issuer === "greenGoods" ? m.greenGoodsSafe : techAndSunSafe);
  const transactions: CLCDeploymentTransaction[] = (["greenGoods", "techAndSun"] as const).map((issuer, index) => ({
    component: index === 0 ? "greenGoodsTimelock" : "techAndSunTimelock",
    chainId: 100,
    kind: "timelock",
    from: deployer,
    nonce: nonce + index,
    address: addresses[index === 0 ? "greenGoodsTimelock" : "techAndSunTimelock"],
    to: null,
    value: "0",
    data: concat([
      `0x${artifact.bytecode.object.replace(/^0x/, "")}`,
      new Interface(CLC_TIMELOCK_ABI).encodeDeploy([
        m.minimumUpgradeDelay,
        [safeFor(issuer)],
        [safeFor(issuer)],
        ZeroAddress,
      ]),
    ]),
  }));
  const initializers: Record<string, [keyof typeof CLC_DEPENDENCIES, string]> = {
    greenGoodsToken: [
      "token",
      encode(CLC_TOKEN_ABI, "initialize", [
        m.issuers.greenGoods.name,
        m.issuers.greenGoods.symbol,
        m.decimals,
        m.greenGoodsSafe,
        m.expiresAt,
      ]),
    ],
    techAndSunToken: [
      "token",
      encode(CLC_TOKEN_ABI, "initialize", [
        m.issuers.techAndSun.name,
        m.issuers.techAndSun.symbol,
        m.decimals,
        m.techAndSunSafe,
        m.expiresAt,
      ]),
    ],
    index: ["index", encode(CLC_INDEX_ABI, "initialize", [m.greenGoodsSafe, [], []])],
    limiter: ["limiter", encode(CLC_LIMITER_ABI, "initialize", [m.greenGoodsSafe])],
    quoter: ["quoter", encode(CLC_QUOTER_ABI, "initialize", [m.greenGoodsSafe])],
    feePolicy: ["feePolicy", encode(CLC_FEE_POLICY_ABI, "initialize", [m.greenGoodsSafe, m.pool.poolFee])],
    protocolFee: [
      "protocolFee",
      encode(CLC_PROTOCOL_FEE_ABI, "initialize", [m.greenGoodsSafe, m.pool.protocolFee, m.greenGoodsSafe]),
    ],
    pool: [
      "pool",
      encode(CLC_POOL_ABI, "initialize", [
        m.pool.name,
        m.pool.symbol,
        m.decimals,
        m.greenGoodsSafe,
        addresses.feePolicy,
        m.greenGoodsSafe,
        addresses.index,
        addresses.limiter,
        addresses.quoter,
        m.pool.feesDecoupled,
        addresses.protocolFee,
      ]),
    ],
  };
  for (const [index, component] of CLC_COMPONENTS.slice(2).entries()) {
    const [dependency, initializer] = initializers[component];
    const implementation = CLC_DEPENDENCIES[dependency].address;
    const admin = component === "techAndSunToken" ? addresses.techAndSunTimelock : addresses.greenGoodsTimelock;
    transactions.push({
      component,
      chainId: 100,
      kind: "proxy",
      from: deployer,
      nonce: nonce + index + 2,
      address: addresses[component],
      to: CLC_DEPENDENCIES.factory.address,
      value: "0",
      salt: salts[component],
      implementation,
      admin,
      initializer,
      data: encode(CLC_FACTORY_ABI, "deployDeterministicAndCall", [
        implementation,
        admin,
        salts[component],
        initializer,
      ]),
    });
  }
  const configurationTransactions: CLCReviewTransaction[] = [];
  const issuanceTransactions: CLCReviewTransaction[] = [];
  function draft(
    list: CLCReviewTransaction[],
    from: string,
    to: string | null,
    operation: string,
    data: string | null,
    missing: string[],
  ) {
    list.push({
      chainId: 100,
      from,
      to,
      value: "0",
      operation,
      data,
      executable: missing.length === 0 && data !== null,
      missing: [...missing],
      reviewOnly: true,
    });
  }
  for (const issuer of ["greenGoods", "techAndSun"] as const) {
    const i = m.issuers[issuer];
    const token = addresses[issuer === "greenGoods" ? "greenGoodsToken" : "techAndSunToken"];
    const safe = safeFor(issuer);
    const prefix = `issuers.${issuer}`;
    const approvalMissing = activationMissing.filter(
      (field) => field.startsWith(`${prefix}.`) && !field.endsWith("sourceIssuerAuthority"),
    );
    for (const [to, operation, data] of [
      [addresses.index, "register", encode(CLC_INDEX_ABI, "register", [token])],
      [
        addresses.limiter,
        "setLimitFor",
        encode(CLC_LIMITER_ABI, "setLimitFor", [token, addresses.pool, i.poolHoldingCap]),
      ],
      [
        addresses.quoter,
        "setPriceIndexValue",
        encode(CLC_QUOTER_ABI, "setPriceIndexValue", [token, m.pool.priceIndex]),
      ],
    ])
      draft(configurationTransactions, m.greenGoodsSafe, to, operation, data, approvalMissing);
    draft(
      issuanceTransactions,
      safe,
      token,
      "mintTo",
      encode(CLC_TOKEN_ABI, "mintTo", [safe, i.initialSupply]),
      approvalMissing,
    );
    draft(
      issuanceTransactions,
      safe,
      token,
      "approvePool",
      encode(CLC_TOKEN_ABI, "approve", [addresses.pool, i.poolInventory]),
      approvalMissing,
    );
    draft(
      issuanceTransactions,
      safe,
      addresses.pool,
      "deposit",
      encode(CLC_POOL_ABI, "deposit", [token, i.poolInventory]),
      approvalMissing,
    );
    const authorityMissing = [
      ...approvalMissing,
      ...activationMissing.filter((field) => field === "earnedAdapter" || field === `${prefix}.sourceIssuerAuthority`),
    ];
    const authorityReady = m.earnedAdapter !== null && i.sourceIssuerAuthority !== null;
    draft(
      issuanceTransactions,
      safe,
      m.earnedAdapter,
      "configureAsset",
      authorityReady
        ? encode(["function configureAsset(address,address,bool)"], "configureAsset", [
            token,
            i.sourceIssuerAuthority,
            true,
          ])
        : null,
      authorityMissing,
    );
    draft(
      issuanceTransactions,
      safe,
      token,
      "approveAdapter",
      authorityReady ? encode(CLC_TOKEN_ABI, "approve", [m.earnedAdapter, i.adapterAllowance]) : null,
      authorityMissing,
    );
  }
  draft(
    configurationTransactions,
    m.greenGoodsSafe,
    addresses.pool,
    "seal",
    encode(CLC_POOL_ABI, "seal", [31]),
    activationMissing.filter((field) => !field.endsWith("sourceIssuerAuthority") && field !== "earnedAdapter"),
  );
  return {
    schemaVersion: 1,
    kind: "CLC_PILOT_PREPARATION",
    releaseId: m.releaseId,
    sourceCommit,
    manifestHash,
    artifactHash,
    addresses,
    transactions,
    configurationTransactions,
    issuanceTransactions,
    activationMissing,
    initialState: { tokenSupply: "0", poolInventory: "0", registeredTokens: [], defaultHoldingLimit: "0" },
    activationIncluded: false,
    liveBroadcast: false,
  };
}
export function validateCLCPilotPlan(
  plan: unknown,
  manifest: unknown,
  artifact: VoucherArtifact,
  sourceCommit: string,
): asserts plan is CLCPilotPlan {
  if (digest(plan) !== digest(buildCLCPilotPlan(manifest, artifact, sourceCommit)))
    throw new Error("CLC pilot release plan mismatch");
}
