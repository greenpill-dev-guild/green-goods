import { Contract, Interface, type JsonRpcProvider, keccak256, ZeroAddress } from "ethers";
import { type CLCGardenManifest, type CLCGardenPlan, validateCLCGardenPlan } from "./clc-garden-release";
import { verifyCLCAdoptionPrefix } from "./clc-member-adoption";
import { getCLCProxyRuntime } from "./clc-member-readback";
import {
  CLC_DEPENDENCIES,
  CLC_FACTORY_ABI,
  CLC_FACTORY_INIT_CODE_HASH,
  CLC_POOL_ABI,
  CLC_TOKEN_ABI,
} from "./clc-release";
import { readCLCAdoptedGardenState, verifyCLCGardenAuthorities, verifyCLCGardenPool } from "./clc-garden-readback";
import { voucherDigest } from "./voucher-release";

export const GARDEN_MAX_FEE = 2_000_000_000n;
export const GARDEN_PRIORITY_FEE = 1_000_000_000n;
export const GARDEN_NATIVE_BUDGET = 100_000_000_000_000_000n;
export interface GardenExecutionJournal {
  schemaVersion: 1;
  kind: "CLC_GARDEN_DEPLOYMENT_EXECUTION";
  evidence: "canonical-live";
  chainId: 100;
  sourceCommit: string;
  planHash: string;
  transactions: Record<string, string>;
  replacements: { component: string; previousHash: string; transactionHash: string }[];
  pending: { component: string; nonce: number; transactionHash: string | null } | null;
}
export interface GardenVerifiedReceipt {
  component: string;
  address: string;
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  runtimeHash: string;
  actualCostWei: string;
}
function equal(actual: unknown, expected: unknown, label: string): void {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase())
    throw new Error(`Garden execution ${label} mismatch`);
}
export function gardenExecutionJournal(plan: CLCGardenPlan): GardenExecutionJournal {
  return {
    schemaVersion: 1,
    kind: "CLC_GARDEN_DEPLOYMENT_EXECUTION",
    evidence: "canonical-live",
    chainId: 100,
    sourceCommit: plan.sourceCommit,
    planHash: voucherDigest(plan),
    transactions: {},
    replacements: [],
    pending: null,
  };
}
export function validateGardenExecutionJournal(
  value: unknown,
  plan: CLCGardenPlan,
): asserts value is GardenExecutionJournal {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid garden journal");
  const journal = value as GardenExecutionJournal;
  const expected = gardenExecutionJournal(plan);
  if (Object.keys(journal).sort().join() !== Object.keys(expected).sort().join())
    throw new Error("Invalid garden journal fields");
  for (const key of ["schemaVersion", "kind", "evidence", "chainId", "sourceCommit", "planHash"] as const)
    equal(journal[key], expected[key], key);
  if (!journal.transactions || typeof journal.transactions !== "object" || Array.isArray(journal.transactions))
    throw new Error("Invalid journal receipts");
  const components = plan.transactions.slice(0, Object.keys(journal.transactions).length).map((tx) => tx.component);
  if (
    Object.keys(journal.transactions).sort().join() !== [...components].sort().join() ||
    Object.values(journal.transactions).some((hash) => typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash))
  )
    throw new Error("Journal must contain an exact deployment prefix");
  if (journal.pending !== null) {
    const next = plan.transactions[components.length];
    const pending = journal.pending;
    if (
      !next ||
      !pending ||
      Object.keys(pending).sort().join() !== "component,nonce,transactionHash" ||
      pending.component !== next.component ||
      pending.nonce !== next.nonce ||
      (pending.transactionHash !== null && !/^0x[0-9a-f]{64}$/i.test(pending.transactionHash))
    )
      throw new Error("Unbound pending garden deployment");
  }
  if (
    !Array.isArray(journal.replacements) ||
    journal.replacements.some(
      (row) =>
        !row ||
        Object.keys(row).sort().join() !== "component,previousHash,transactionHash" ||
        !/^0x[0-9a-f]{64}$/i.test(row.previousHash) ||
        row.previousHash.toLowerCase() === row.transactionHash.toLowerCase() ||
        journal.transactions[row.component]?.toLowerCase() !== row.transactionHash.toLowerCase(),
    )
  )
    throw new Error("Invalid canonical replacement audit");
}
/** This result is written only after canonical live receipts and current initialized state are verified. */
export function gardenRegistration(
  plan: CLCGardenPlan,
  journal: GardenExecutionJournal,
  receipts: GardenVerifiedReceipt[],
) {
  validateGardenExecutionJournal(journal, plan);
  if (
    journal.pending ||
    receipts.length !== plan.transactions.length ||
    Object.keys(journal.transactions).length !== receipts.length
  )
    throw new Error("Complete canonical deployment receipts required for registration");
  for (const [index, tx] of plan.transactions.entries()) {
    const row = receipts[index];
    equal(row.component, tx.component, "registration component");
    equal(row.address, tx.address, "registration address");
    equal(row.transactionHash, journal.transactions[tx.component], "registration receipt");
    equal(row.runtimeHash, keccak256(getCLCProxyRuntime()), "registration runtime");
    if (!Number.isSafeInteger(row.blockNumber) || row.blockNumber < 0 || !/^0x[0-9a-f]{64}$/i.test(row.blockHash))
      throw new Error("Invalid registration block");
  }
  const local = plan.pools.techAndSun;
  const poolReceipt = receipts.find((row) => row.component === "tech-and-sun:pool")!;
  const pin = (component: string) => {
    const tx = plan.transactions.find((row) => row.component === `tech-and-sun:${component}`)!;
    const receipt = receipts.find((row) => row.component === tx.component)!;
    const dependency = Object.values(CLC_DEPENDENCIES).find(
      (row) => row.address.toLowerCase() === tx.implementation.toLowerCase(),
    )!;
    return {
      address: tx.address,
      owner: local.owner,
      runtimeCodeHash: receipt.runtimeHash,
      implementation: { address: tx.implementation, runtimeCodeHash: dependency.runtimeHash },
      receipt: {
        transactionHash: receipt.transactionHash,
        blockHash: receipt.blockHash,
        blockNumber: receipt.blockNumber,
      },
      factoryDeployment: { deployer: tx.from, admin: tx.admin, salt: tx.salt, initializer: tx.initializer },
    };
  };
  const pool = pin("pool");
  const localName = new Interface(CLC_POOL_ABI).decodeFunctionData("initialize", pool.factoryDeployment.initializer)[0];
  return {
    schemaVersion: 3,
    kind: "CLC_GARDEN_EXCHANGES_DEPLOYED",
    evidence: "canonical-live",
    chainId: 100,
    releaseId: plan.releaseId,
    sourceCommit: plan.sourceCommit,
    planHash: voucherDigest(plan),
    assets: plan.assets,
    pools: plan.pools,
    contracts: plan.transactions.map((tx, index) => ({
      component: tx.component,
      address: tx.address,
      implementation: tx.implementation,
      factory: CLC_DEPENDENCIES.factory.address,
      admin: tx.admin,
      factoryDeployment: { deployer: tx.from, salt: tx.salt, initializer: tx.initializer },
      receipt: receipts[index],
    })),
    // Deployment is sufficient to index subsequent admission/funding events; app activation still needs its own readback.
    indexerRegistration: {
      contract: "CLCSwapPool",
      chainId: 100,
      poolId: local.id,
      address: local.addresses.pool,
      startBlock: poolReceipt.blockNumber,
      deploymentTransactionHash: poolReceipt.transactionHash,
      deploymentBlockHash: poolReceipt.blockHash,
    },
    appRegistration: {
      status: "deployment-verified-activation-pending",
      poolId: local.id,
      factory: { address: CLC_DEPENDENCIES.factory.address, runtimeCodeHash: CLC_DEPENDENCIES.factory.runtimeHash },
      pool: {
        id: local.id,
        name: localName,
        garden: local.garden,
        chainId: 100,
        proxyAdmin: local.proxyAdmin,
        deployment: pool,
        registry: pin("index"),
        limiter: pin("limiter"),
        quoter: pin("quoter"),
        feePolicy: pin("feePolicy"),
        protocolFee: pin("protocolFee"),
        feeAddress: local.owner,
        feesDecoupled: true,
        listings: local.listings.map((row) => ({
          assetId: row.assetId,
          poolHoldingCap: row.poolHoldingCap,
          priceIndex: row.priceIndex,
          delisting: null,
        })),
      },
      activationMissing: plan.activationMissing,
      activationIncluded: false,
    },
    liveBroadcast: true,
    ownerActivationPending: true,
  };
}
/** Explicit replacement recovery still proves the exact planned sender, nonce, target, value and calldata. */
export async function recoverGardenExecutionJournal(
  provider: JsonRpcProvider,
  plan: CLCGardenPlan,
  journal: GardenExecutionJournal,
  supplied: unknown = { transactions: {} },
) {
  validateGardenExecutionJournal(journal, plan);
  if (
    !supplied ||
    typeof supplied !== "object" ||
    Array.isArray(supplied) ||
    Object.keys(supplied).join() !== "transactions"
  )
    throw new Error("Invalid garden recovery receipts");
  const extras = (supplied as { transactions: Record<string, string> }).transactions;
  if (!extras || typeof extras !== "object" || Array.isArray(extras)) throw new Error("Invalid recovery receipt map");
  const recovered = { ...journal.transactions };
  for (const [component, hash] of Object.entries(extras)) {
    if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash))
      throw new Error("Invalid recovery transaction hash");
    if (recovered[component] && recovered[component].toLowerCase() !== hash.toLowerCase())
      throw new Error("Recovery cannot replace a completed receipt");
    recovered[component] = hash;
  }
  const replacements = [...journal.replacements];
  if (journal.pending) {
    const pending = journal.pending;
    const explicit = recovered[pending.component];
    if (explicit && pending.transactionHash && explicit.toLowerCase() !== pending.transactionHash.toLowerCase())
      replacements.push({
        component: pending.component,
        previousHash: pending.transactionHash,
        transactionHash: explicit,
      });
    else if (!explicit && pending.transactionHash) recovered[pending.component] = pending.transactionHash;
    if (!recovered[pending.component])
      throw new Error("Ambiguous pending send needs its exact receipt; do not rebroadcast");
  }
  const candidate = { ...journal, transactions: recovered, replacements, pending: null };
  await verifyGardenExecutionReceipts(provider, plan, candidate);
  return candidate;
}
export async function verifyGardenExecutionReceipts(
  provider: JsonRpcProvider,
  plan: CLCGardenPlan,
  journal: GardenExecutionJournal,
) {
  validateGardenExecutionJournal(journal, plan);
  equal((await provider.getNetwork()).chainId, 100, "chain");
  await verifyCLCAdoptionPrefix(provider, plan, { transactions: journal.transactions });
  const factory = new Contract(CLC_DEPENDENCIES.factory.address, CLC_FACTORY_ABI, provider);
  const rows: GardenVerifiedReceipt[] = [];
  for (const tx of plan.transactions.slice(0, Object.keys(journal.transactions).length)) {
    const hash = journal.transactions[tx.component];
    const receipt = await provider.getTransactionReceipt(hash),
      sent = await provider.getTransaction(hash);
    if (!receipt || !sent) throw new Error("Canonical receipt disappeared");
    equal(await provider.getCode(tx.address), getCLCProxyRuntime(), "proxy runtime");
    equal(await factory.adminOf(tx.address), tx.admin, "proxy admin");
    const implementation = await provider.getStorage(
      tx.address,
      "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
    );
    equal(`0x${implementation.slice(-40)}`, tx.implementation, "proxy implementation");
    if (
      sent.gasLimit <= 0n ||
      sent.maxFeePerGas === null ||
      sent.maxFeePerGas > GARDEN_MAX_FEE ||
      receipt.gasPrice > GARDEN_MAX_FEE ||
      receipt.gasUsed > sent.gasLimit
    )
      throw new Error("Garden receipt fee bounds exceeded");
    rows.push({
      component: tx.component,
      address: tx.address,
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      runtimeHash: keccak256(await provider.getCode(tx.address)),
      actualCostWei: String(receipt.gasUsed * receipt.gasPrice),
    });
  }
  if (rows.reduce((sum, row) => sum + BigInt(row.actualCostWei), 0n) > GARDEN_NATIVE_BUDGET)
    throw new Error("Garden deployment budget exceeded");
  return rows;
}
/** Durable intent precedes sending. An ambiguous attempt can only be reconciled by its canonical receipt. */
export async function executeGardenDeployment(options: {
  provider: JsonRpcProvider;
  plan: CLCGardenPlan;
  manifest: CLCGardenManifest;
  revision: string;
  journal: GardenExecutionJournal;
  save: (journal: GardenExecutionJournal) => void;
  assertBindings: () => void;
  gasLimits?: Record<string, string>;
  send?: (transaction: CLCGardenPlan["transactions"][number], gasLimit: bigint) => Promise<string>;
}) {
  const { provider, plan, manifest, journal, save, assertBindings } = options;
  validateCLCGardenPlan(plan, manifest, options.revision);
  validateGardenExecutionJournal(journal, plan);
  equal((await provider.getNetwork()).chainId, 100, "chain");
  if (journal.pending)
    throw new Error("Pending garden deployment requires canonical receipt recovery before another send");
  for (const dependency of Object.values(CLC_DEPENDENCIES))
    equal(keccak256(await provider.getCode(dependency.address)), dependency.runtimeHash, "CLC dependency");
  const factory = new Contract(CLC_DEPENDENCIES.factory.address, CLC_FACTORY_ABI, provider);
  equal(await factory.initCodeHash(), CLC_FACTORY_INIT_CODE_HASH, "factory identity");
  const authority = await verifyCLCGardenAuthorities(provider, plan);
  const before = await readCLCAdoptedGardenState(provider, plan);
  let receipts = await verifyGardenExecutionReceipts(provider, plan, journal);
  let reserved = receipts.reduce((sum, row) => sum + BigInt(row.actualCostWei), 0n);
  const remaining = plan.transactions.slice(receipts.length);
  if (remaining.length && !options.send)
    throw new Error("Garden deployment is incomplete; canonical receipt recovery remains available");
  for (const tx of remaining) {
    const raw = options.gasLimits?.[tx.component];
    if (!raw || !/^[1-9][0-9]*$/.test(raw)) throw new Error("Missing rehearsed garden gas envelope");
    reserved += BigInt(raw) * GARDEN_MAX_FEE;
  }
  if (reserved > GARDEN_NATIVE_BUDGET) throw new Error("Garden deployment exceeds native budget");
  for (const tx of remaining) {
    assertBindings();
    for (const tag of ["latest", "pending"])
      equal(Number(await provider.send("eth_getTransactionCount", [tx.from, tag])), tx.nonce, "deployment nonce");
    equal(await provider.getCode(tx.address), "0x", "unused deployment address");
    equal(await factory.adminOf(tx.address), ZeroAddress, "unused proxy admin");
    equal(await factory.predictDeterministicAddress(tx.salt), tx.address, "predicted address");
    const gasLimit = BigInt(options.gasLimits![tx.component]);
    if (
      (await provider.estimateGas({ from: tx.from, to: tx.to, data: tx.data, value: 0n, nonce: tx.nonce })) > gasLimit
    )
      throw new Error("Live deployment gas exceeds rehearsal");
    journal.pending = { component: tx.component, nonce: tx.nonce, transactionHash: null };
    save(journal);
    const hash = await options.send!(tx, gasLimit);
    if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("Missing submitted garden transaction hash");
    journal.pending.transactionHash = hash;
    save(journal);
    const receipt = await provider.waitForTransaction(hash, 1, 180000);
    if (!receipt || receipt.status !== 1)
      throw new Error("Garden deployment receipt unavailable or failed; reconcile pending intent");
    const candidate = { ...journal, transactions: { ...journal.transactions, [tx.component]: hash }, pending: null };
    receipts = await verifyGardenExecutionReceipts(provider, plan, candidate);
    Object.assign(journal, candidate);
    save(journal);
  }
  assertBindings();
  await verifyCLCGardenPool(provider, plan.pools.techAndSun, manifest);
  for (const asset of plan.assets.filter((row) => row.mode === "deploy")) {
    const token = new Contract(asset.token, CLC_TOKEN_ABI, provider);
    equal(await token.owner(), asset.ownerReserve, "member owner");
    equal(await token.totalSupply(), 0, "member issuance excluded");
    equal(await token.isWriter(plan.transactions[0].from), false, "deployer mint authority excluded");
  }
  const after = await readCLCAdoptedGardenState(provider, plan);
  equal(voucherDigest(after), voucherDigest(before), "adopted state unchanged during execution");
  equal(
    voucherDigest(await verifyCLCGardenAuthorities(provider, plan)),
    voucherDigest(authority),
    "governance unchanged during execution",
  );
  const observed = await provider.getBlock("latest");
  if (!observed?.hash) throw new Error("Missing deployment readback block");
  return {
    deployment: gardenRegistration(plan, journal, receipts),
    readback: {
      chainId: 100,
      planHash: voucherDigest(plan),
      blockNumber: observed.number,
      blockHash: observed.hash,
      authority,
      ...after,
    },
  };
}
