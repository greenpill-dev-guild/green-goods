// One-shot operator for the approved Cosmo pilot. No Safe owner call is broadcast here.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import {
  Contract,
  Interface,
  JsonRpcProvider,
  keccak256,
  toQuantity,
  concat,
  zeroPadValue,
  getAddress,
  TypedDataEncoder,
  solidityPacked,
  type TransactionResponse,
  type TransactionReceipt,
} from "ethers";
import { config as loadEnvironment } from "dotenv";
import { buildStewardPlan, loadStewardArtifacts, STEWARD_CONTRACTS } from "../utils/steward-safe-release";
import { buildVoucherPlan, loadVoucherArtifacts, voucherDigest, VOUCHER_CONTRACTS } from "../utils/voucher-release";
import {
  buildCLCPilotPlan,
  loadCLCTimelockArtifact,
  CLC_DEPENDENCIES,
  CLC_TIMELOCK_SOURCE,
  CLC_FACTORY_ABI,
} from "../utils/clc-release";
import { verifyEmptyState, verifyTimelock, verifyGreenGoodsAuthority } from "../utils/clc-release-simulation";
import {
  startIsolatedFork,
  assertIsolatedRpc,
  minedIsolatedReceipt,
  maskImmutableRuntime,
} from "../utils/isolated-fork";
import { withKeystorePassword } from "../utils/keystore-session";
import { execCastCaptured, parseCastTransactionHash } from "../utils/cast-env";
import { NetworkManager } from "../utils/network";
import { CONTRACTS_ROOT, getFoundryOutDir } from "../utils/paths";
import { releaseRevision } from "../utils/release-inputs";
import { writeReleaseJsonAtomic } from "../utils/release-artifacts";
import { sourceUpgradeStateReaders } from "../utils/source-upgrade-readback";
import { assertSourceBatchOuter, assertSourceBatchSuccess } from "../utils/source-upgrade-batch";

const GG = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19",
  SENDER = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
const AFO = "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e";
const SOURCE_TX = "0xabdff0d7998aefeb1cb0ffb274abc681ae7aa2a2dbb78127edbc473a738bc3a9";
const RELAY = "0x781388759EacB9892f60D77D9A99c9BE2F7F4ada";
const EIP1967 = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const SAFE = new Interface([
  "function getOwners() view returns(address[])",
  "function getThreshold() view returns(uint256)",
  "function nonce() view returns(uint256)",
  "function approveHash(bytes32)",
  "function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) returns(bool)",
]);
const Q = path.join(CONTRACTS_ROOT, ".generated/deployment-queue");
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const same = (a: unknown, b: unknown, label: string) => {
  if (String(a).toLowerCase() !== String(b).toLowerCase()) throw Error(label + " mismatch");
};
const canonical = (v: unknown) => voucherDigest(v);
const fee = (chain: number) => (chain === 100 ? 2_000_000_000n : 50_000_000n);
const priority = (chain: number) => (chain === 100 ? 1_000_000_000n : 0n);
const cap = (chain: number) => (chain === 100 ? 100_000_000_000_000_000n : 2_800_000_000_000_000n);
type Tx = {
  chainId: number;
  from: string;
  nonce: number;
  to: string | null;
  value: string;
  data: string;
  address?: string;
  contract?: string;
  kind?: string;
  component?: string;
  runtimeTemplate?: string;
  immutableReferences?: any;
};
async function requiredCall(p: JsonRpcProvider, to: string, method: string, args: unknown[] = []) {
  const abi = new Interface([method]);
  const name = (abi.fragments[0] as any).name;
  return abi.decodeFunctionResult(name, await p.call({ to, data: abi.encodeFunctionData(name, args) }))[0];
}
async function sourceProof(p: JsonRpcProvider) {
  const d = path.join(CONTRACTS_ROOT, ".generated/source-upgrades");
  const record = read(path.join(d, "voucher-source-upgrades.safe-batch.review.json"));
  const envelope = read(path.join(d, "voucher-source-upgrades.execution.json"));
  const manifest = read(path.join(CONTRACTS_ROOT, "config/source-upgrade-release.json"));
  const journal = read(path.join(d, "42161-source-upgrade-execution.json"));
  const tx = await p.getTransaction(SOURCE_TX),
    receipt = await p.getTransactionReceipt(SOURCE_TX);
  if (!tx || !receipt || receipt.status !== 1 || tx.value !== 0n || tx.chainId !== 42161n)
    throw Error("Canonical source upgrade receipt required");
  same((await p.getBlock(receipt.blockNumber))?.hash, receipt.blockHash, "Source canonical block");
  const sourceCost = receipt.gasUsed * receipt.gasPrice;
  if (sourceCost > BigInt(record.externalCostLimitWei))
    throw Error("Source upgrade exceeded its reviewed external gas cap");
  let data = tx.data;
  if (tx.to?.toLowerCase() === RELAY.toLowerCase()) {
    const relay = new Interface(["function execute(uint256,address,bytes)"]);
    const args = relay.decodeFunctionData("execute", data);
    same(args[1], GG, "Relay Safe");
    same(relay.encodeFunctionData("execute", args), data, "Canonical relay calldata");
    data = args[2];
    // This wrapper only CALLs its target and bubbles failure; code and intent are recorded for review.
    same(
      keccak256(await p.getCode(RELAY, receipt.blockNumber)),
      "0xdb88768efd94cc473ef935099a78d2f0ea4f0abaac94a8c8de272eb44f3edac4",
      "Reviewed relay runtime",
    );
  } else same(tx.to, GG, "Direct Safe target");
  assertSourceBatchOuter(data, record.batch);
  assertSourceBatchSuccess(
    receipt.logs.map((l) => ({ address: l.address, topics: [...l.topics], data: l.data })),
    record.batch,
  );
  const out = getFoundryOutDir("production");
  const abis: any = {};
  for (const [target, file, name] of [
    ["pooling", "CommitmentPooling", "CommitmentPoolingModule"],
    ["settlement", "SettlementModule", "SettlementModule"],
  ])
    abis[target] = new Interface(read(path.join(out, file + ".sol", name + ".json")).abi);
  const readers = sourceUpgradeStateReaders({ provider: p, manifest, abis });
  for (const at of [receipt.blockNumber, Number((await p.getBlock("latest"))!.number)]) {
    const safe = await readers.getSafeState(at);
    same(safe.nonce, 34, "Current source Safe nonce");
    same(safe.threshold, 2, "Source threshold");
    for (const key of ["guard", "moduleGuard", "runtimeHash", "singleton", "singletonRuntimeHash", "modules"])
      same(canonical((safe as any)[key]), canonical(envelope.baseline.safe[key]), "Original Safe " + key);
    same(canonical(safe.owners), canonical(envelope.baseline.safe.owners), "Original source owners");
    for (const target of ["pooling", "settlement"] as const) {
      const state = await readers.getProxyState(target, at);
      same(state.owner, GG, "Source owner");
      same(state.paused, true, "Source remains paused");
      same(
        canonical(state.preserved),
        canonical(envelope.baseline.sources[target].preserved),
        "Preserved source state",
      );
      const expected = journal.completed.find((e: any) => e.step === (target === "pooling" ? 22 : 23));
      const planned = read(path.join(d, "voucher-source-upgrades.plan.json")).deployments[
        target === "pooling" ? 21 : 22
      ];
      same(state.implementation, planned.address, "Source implementation");
      same(keccak256(await p.getCode(planned.address, at)), expected.runtimeHash, "Source implementation runtime");
    }
  }
  return {
    transactionHash: SOURCE_TX,
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    safeNonceAfter: 34,
    relayed: tx.to?.toLowerCase() === RELAY.toLowerCase(),
    formalLegacyAdoption: false,
    externalPayer: tx.from,
    actualCostWei: String(sourceCost),
    safePaymentWei: "0",
  };
}

const SAFE_TYPES = {
  SafeTx: [
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "operation", type: "uint8" },
    { name: "safeTxGas", type: "uint256" },
    { name: "baseGas", type: "uint256" },
    { name: "gasPrice", type: "uint256" },
    { name: "gasToken", type: "address" },
    { name: "refundReceiver", type: "address" },
    { name: "nonce", type: "uint256" },
  ],
};
const ZERO = "0x0000000000000000000000000000000000000000";
const METHODS = new Interface([
  "function pinEarnedVoucherModule(address)",
  "function pinVoucherServiceSetupModule(address)",
  "function setIssuerAuthority(address,address,address)",
  "function unpause()",
  "function setPaused(bool)",
  "function configureAsset(address,address,bool)",
  "function approve(address,uint256) returns(bool)",
]);
const encoded = (to: string, name: string, args: unknown[] = []) => ({
  to,
  value: "0",
  data: METHODS.encodeFunctionData(name, args),
});
async function batchesFor(plan: any, p: JsonRpcProvider, chain: number) {
  const a = plan.clc.addresses,
    c = plan.inputs.clc;
  const proxy = (name: string) =>
    plan.vouchers.transactions.find((t: any) => t.contract === name && t.kind === "proxy").address;
  const row = (t: any) => ({ to: t.to, value: "0", data: t.data });
  const gg =
    chain === 100
      ? [
          ...plan.clc.configurationTransactions.map(row),
          ...plan.clc.issuanceTransactions
            .filter((t: any) => t.from.toLowerCase() === GG.toLowerCase() && t.data)
            .map(row),
          encoded(c.earnedAdapter, "configureAsset", [a.greenGoodsToken, GG, true]),
          encoded(a.greenGoodsToken, "approve", [c.earnedAdapter, c.issuers.greenGoods.adapterAllowance]),
          encoded(proxy("GnosisVoucherAdapter"), "unpause"),
          encoded(proxy("GnosisVoucherEscrow"), "unpause"),
        ]
      : [
          encoded(plan.inputs.vouchers.networks.arbitrum.commitmentPooling, "pinEarnedVoucherModule", [
            proxy("VoucherEntitlementModule"),
          ]),
          encoded(plan.inputs.vouchers.networks.arbitrum.commitmentPooling, "pinVoucherServiceSetupModule", [
            proxy("VoucherRedemptionModule"),
          ]),
          encoded(proxy("VoucherEntitlementModule"), "setIssuerAuthority", [GG, a.greenGoodsToken, GG]),
          encoded(proxy("VoucherEntitlementModule"), "setIssuerAuthority", [c.techAndSunSafe, a.techAndSunToken, AFO]),
          encoded(proxy("VoucherEntitlementModule"), "unpause"),
          encoded(proxy("VoucherRedemptionModule"), "unpause"),
          encoded(plan.inputs.vouchers.networks.arbitrum.commitmentPooling, "setPaused", [false]),
          encoded("0x15c8F6CF25abA2161cc04719b4C4a93c4146935D", "setPaused", [false]),
        ];
  const ts = [
    ...plan.clc.issuanceTransactions
      .filter((t: any) => t.from.toLowerCase() === c.techAndSunSafe.toLowerCase() && t.data)
      .map(row),
    encoded(c.earnedAdapter, "configureAsset", [a.techAndSunToken, AFO, true]),
    encoded(a.techAndSunToken, "approve", [c.earnedAdapter, c.issuers.techAndSun.adapterAllowance]),
  ];
  const version = await requiredCall(p, GG, "function VERSION() view returns(string)");
  if (!["1.5.0", "1.4.1", "1.3.0"].includes(version)) throw Error("Unreviewed GG Safe version");
  return (
    chain === 100
      ? [
          { safe: GG, nonce: 2, calls: gg, file: "100-green-goods-consolidated", version },
          {
            safe: c.techAndSunSafe,
            nonce: 0,
            calls: ts,
            file: "100-tech-and-sun-consolidated",
            version: "1.4.1",
          },
        ]
      : [{ safe: GG, nonce: 34, calls: gg, file: "42161-green-goods-final", version }]
  ).map((r) => {
    const helper =
      r.version === "1.5.0"
        ? "0xA83c336B20401Af773B6219BA5027174338D1836"
        : r.version === "1.3.0"
          ? "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D"
          : "0x9641d764fc13c8B624c04430C7356C1C7C8102e2";
    const packed = concat(
      r.calls.map((t: any) =>
        solidityPacked(
          ["uint8", "address", "uint256", "uint256", "bytes"],
          [0, t.to, 0, (t.data.length - 2) / 2, t.data],
        ),
      ),
    );
    const domain = { chainId: chain, verifyingContract: r.safe },
      message = {
        to: helper,
        value: "0",
        data: new Interface(["function multiSend(bytes)"]).encodeFunctionData("multiSend", [packed]),
        operation: 1,
        safeTxGas: "0",
        baseGas: "0",
        gasPrice: "0",
        gasToken: ZERO,
        refundReceiver: ZERO,
        nonce: r.nonce,
      };
    return {
      ...r,
      chainId: chain,
      domain,
      types: SAFE_TYPES,
      message,
      safeTransactionHash: TypedDataEncoder.hash(domain, SAFE_TYPES, message),
      ownerApprovalPending: true,
      termsAccepted: false,
    };
  });
}
function serializeBuilder(v: any): string {
  if (Array.isArray(v)) return `[${v.map(serializeBuilder).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const ks = Object.keys(v).sort();
    return `{${JSON.stringify(ks)}${ks.map((k) => `${serializeBuilder(v[k])},`).join("")}}`;
  }
  return JSON.stringify(v === undefined ? null : v);
}
function exportPacket(r: any) {
  const file = {
    version: "1.0",
    chainId: String(r.chainId),
    createdAt: Date.now(),
    meta: {
      name: r.file,
      description:
        "Consolidated setup: proposed finite issuance, pool configuration and source authorities. Review the companion SafeTx hash, nonce and amounts before signing.",
      createdFromSafeAddress: r.safe,
      createdFromOwnerAddress: "",
    },
    transactions: r.calls,
  };
  const checksum = keccak256(
    new TextEncoder().encode(serializeBuilder({ ...file, meta: { ...file.meta, name: null } })),
  );
  writeReleaseJsonAtomic(path.join(Q, r.file + ".safe-batch.json"), {
    ...file,
    meta: { ...file.meta, checksum },
  });
  writeReleaseJsonAtomic(path.join(Q, r.file + ".safe-batch.review.json"), r);
}

async function ownerBatch(p: JsonRpcProvider, review: any) {
  const safe = new Contract(review.safe, SAFE, p);
  same(await safe.nonce(), review.nonce, "Atomic Safe nonce");
  const owners: string[] = await safe.getOwners();
  const threshold = Number(await safe.getThreshold());
  const selected = owners.slice(0, threshold).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
  const signatures = concat(selected.map((a) => concat([zeroPadValue(a, 32), zeroPadValue("0x00", 32), "0x01"])));
  for (const owner of selected) {
    await p.send("anvil_impersonateAccount", [owner]);
    await p.send("anvil_setBalance", [owner, toQuantity(10n ** 20n)]);
    const hash = await p.send("eth_sendTransaction", [
      {
        from: owner,
        to: review.safe,
        data: SAFE.encodeFunctionData("approveHash", [review.safeTransactionHash]),
        gas: "0x4c4b40",
      },
    ]);
    await minedIsolatedReceipt(p, hash);
  }
  const m = review.message;
  const data = SAFE.encodeFunctionData("execTransaction", [
    m.to,
    0,
    m.data,
    1,
    0,
    0,
    0,
    m.gasToken,
    m.refundReceiver,
    signatures,
  ]);
  const hash = await p.send("eth_sendTransaction", [{ from: selected[0], to: review.safe, data, gas: "0x4c4b40" }]);
  const receipt = await minedIsolatedReceipt(p, hash);
  if (receipt.status !== 1) throw Error("Exact atomic setup batch reverted");
  same(await safe.nonce(), review.nonce + 1, "Atomic Safe nonce increment");
  return {
    safe: review.safe,
    nonce: review.nonce,
    transactionHash: hash,
    gasUsed: String(receipt.gasUsed),
    syntheticOwnerApprovals: true,
  };
}
async function verifyEndpoints(p: JsonRpcProvider, all: any, chain: number) {
  await verifyGreenGoodsAuthority(p, GG);
  const m = all.inputs.vouchers.networks[chain === 100 ? "gnosis" : "arbitrum"];
  for (const t of all.vouchers.transactions.filter((t: any) => t.chainId === chain && t.kind === "proxy")) {
    const owner = await requiredCall(p, t.address, "function owner() view returns(address)");
    same(owner, GG, "Voucher owner");
    same(await requiredCall(p, t.address, "function paused() view returns(bool)"), true, "Voucher pause");
    same(await requiredCall(p, t.address, "function guardian() view returns(address)"), SENDER, "Voucher guardian");
    same(await requiredCall(p, t.address, "function CCIP_ROUTER() view returns(address)"), m.router, "Voucher router");
    same(
      await requiredCall(p, t.address, "function LOCAL_CHAIN_ID() view returns(uint256)"),
      chain,
      "Voucher local chain",
    );
    const peerName = (
      {
        VoucherEntitlementModule: "GnosisVoucherAdapter",
        VoucherRedemptionModule: "GnosisVoucherEscrow",
        GnosisVoucherAdapter: "VoucherEntitlementModule",
        GnosisVoucherEscrow: "VoucherRedemptionModule",
      } as any
    )[t.contract];
    const peer = all.vouchers.transactions.find((x: any) => x.contract === peerName && x.kind === "proxy");
    same(await requiredCall(p, t.address, "function remotePeer() view returns(address)"), peer.address, "Voucher peer");
    const impl = all.vouchers.transactions.find((x: any) => x.contract === t.contract && x.kind === "implementation");
    same(
      getAddress("0x" + (await p.getStorage(t.address, EIP1967)).slice(-40)),
      impl.address,
      "Voucher implementation",
    );
    let rejected = false;
    try {
      await p.call({ from: SENDER, to: t.address, data: t.initializer });
    } catch {
      rejected = true;
    }
    if (!rejected) throw Error("Proxy accepted reinitialization");
  }
  if (chain === 100) {
    const r = all.steward.transactions.find((t: any) => t.chainId === 100).address;
    const other = all.steward.transactions.find((t: any) => t.chainId === 42161).address;
    same(await requiredCall(p, r, "function publisher() view returns(address)"), other, "Steward publisher");
    same(
      await requiredCall(p, r, "function garden() view returns(address)"),
      all.inputs.steward.garden,
      "Steward garden",
    );
    same(
      await requiredCall(p, r, "function getRouter() view returns(address)"),
      all.inputs.steward.networks.gnosis.router,
      "Steward router",
    );
    same(await requiredCall(p, r, "function bootstrapSigner() view returns(address)"), AFO, "Bootstrap signer");
    same(await requiredCall(p, r, "function bootstrapFinalized() view returns(bool)"), false, "Bootstrap mode");
    same(
      await requiredCall(p, r, "function safe() view returns(address)"),
      all.inputs.clc.techAndSunSafe,
      "Predicted Tech and Sun Safe",
    );
    const safe = new Contract(all.inputs.clc.techAndSunSafe, SAFE, p);
    same(await safe.getThreshold(), 1, "Bootstrap threshold");
    same(canonical(await safe.getOwners()), canonical([AFO]), "Bootstrap sole owner");
    await verifyEmptyState(p, all.clc, all.inputs.clc);
    for (const issuer of ["greenGoods", "techAndSun"])
      await verifyTimelock(
        p,
        all.clc.addresses[issuer + "Timelock"],
        issuer === "greenGoods" ? GG : all.inputs.clc.techAndSunSafe,
        SENDER,
      );
    const factory = new Contract(CLC_DEPENDENCIES.factory.address, CLC_FACTORY_ABI, p);
    for (const t of all.clc.transactions.filter((t: any) => t.kind === "proxy")) {
      same(await factory.adminOf(t.address), t.admin, "CLC proxy admin");
      same(
        getAddress("0x" + (await p.getStorage(t.address, EIP1967)).slice(-40)),
        t.implementation,
        "CLC proxy implementation",
      );
    }
  }
}
/** Verify the paid transaction envelope before recording completion or inspecting its runtime. */
export function assertDownstreamReceipt(
  t: Tx,
  b: { gasLimit: string },
  sent: TransactionResponse,
  r: TransactionReceipt,
  canonicalHash: string | null | undefined,
) {
  same(sent.from, SENDER, "Receipt sender");
  same(sent.nonce, t.nonce, "Receipt nonce");
  same(sent.to, t.to, "Receipt target");
  same(sent.data, t.data, "Receipt calldata");
  same(sent.value, BigInt(t.value), "Receipt value");
  same(sent.chainId, t.chainId, "Receipt chain");
  same(sent.gasLimit, b.gasLimit, "Receipt gas");
  same(sent.maxFeePerGas, fee(t.chainId), "Fee cap");
  same(sent.maxPriorityFeePerGas, priority(t.chainId), "Priority fee");
  same(r.hash, sent.hash, "Receipt transaction");
  same(r.blockNumber, sent.blockNumber, "Receipt block number");
  same(r.blockHash, sent.blockHash, "Receipt block hash");
  same(canonicalHash, r.blockHash, "Canonical receipt");
  if (r.gasUsed < 0n || r.gasUsed > sent.gasLimit || r.gasPrice < 0n || r.gasPrice > fee(t.chainId))
    throw Error("Receipt gas bounds mismatch");
  if (!t.to && r.status === 1) same(r.contractAddress, t.address, "Receipt CREATE address");
}
async function main() {
  const { values } = parseArgs({
    options: { broadcast: { type: "boolean" }, help: { type: "boolean" } },
  });
  if (values.help) {
    console.log(
      "bun run contracts -- release downstream --mode <simulate|broadcast>\nRehearses before prompting once. Deployments, observer registration and approved CCIP fuel only; no Safe owner calls broadcast.",
    );
    return;
  }
  loadEnvironment({ path: path.resolve(CONTRACTS_ROOT, "../../.env"), quiet: true });
  process.env.PINATA_JWT = "";
  process.env.PINATA_GATEWAY = "";
  const self = path.resolve(import.meta.filename);
  if (
    execFileSync("git", ["status", "--porcelain=v1", "--", self], {
      cwd: CONTRACTS_ROOT,
      encoding: "utf8",
    }).trim()
  )
    throw Error("Operator source must be committed");
  const revision = releaseRevision(CONTRACTS_ROOT, path.join(CONTRACTS_ROOT, "config/steward-safe-release.json"));
  execFileSync(
    "bun",
    [
      "run",
      "build",
      "--mode",
      "target",
      "--",
      ...STEWARD_CONTRACTS.map((n) => "src/accounts/" + n + ".sol"),
      ...VOUCHER_CONTRACTS.map((c) => c.source),
      CLC_TIMELOCK_SOURCE,
      "src/modules/CommitmentPooling.sol",
      "src/modules/SettlementModule.sol",
    ],
    {
      cwd: CONTRACTS_ROOT,
      env: { ...process.env, FOUNDRY_PROFILE: "production" },
      stdio: "inherit",
    },
  );
  const inputs = read(path.join(Q, "candidate-manifests.json")),
    out = getFoundryOutDir("production");
  same(inputs.steward.bootstrapSigner, AFO, "Approved bootstrap");
  for (const m of [inputs.steward, inputs.vouchers])
    for (const c of Object.values(m.networks) as any[]) same(c.deployer, SENDER, "Approved deployer");
  same(inputs.clc.deployer, SENDER, "CLC deployer");
  const steward = buildStewardPlan(inputs.steward, loadStewardArtifacts(out), revision),
    vouchers = buildVoucherPlan(inputs.vouchers, loadVoucherArtifacts(out), revision),
    clc = buildCLCPilotPlan(inputs.clc, loadCLCTimelockArtifact(out), revision);
  const sa = loadStewardArtifacts(out),
    ta = loadCLCTimelockArtifact(out);
  const txs: Tx[] = [
    ...steward.transactions.map((t) => ({
      ...t,
      runtimeTemplate: "0x" + (sa as any)[t.contract].deployedBytecode.object.replace(/^0x/, ""),
      immutableReferences: (sa as any)[t.contract].deployedBytecode.immutableReferences,
    })),
    ...vouchers.transactions,
    ...clc.transactions.map((t) => ({
      ...t,
      ...(t.kind === "timelock"
        ? {
            runtimeTemplate: "0x" + ta.deployedBytecode.object.replace(/^0x/, ""),
            immutableReferences: ta.deployedBytecode.immutableReferences,
          }
        : {}),
    })),
  ];
  txs.push({
    chainId: 42161,
    from: SENDER,
    nonce: 1069,
    to: steward.observerRegistration.to,
    value: "0",
    data: steward.observerRegistration.data,
  });
  const voucherProxy = (name: string) =>
    vouchers.transactions.find((t) => t.contract === name && t.kind === "proxy")!.address;
  txs.push(
    ...[
      {
        chainId: 42161,
        nonce: 1070,
        to: steward.transactions.find((t) => t.chainId === 42161)!.address,
        value: "500000000000000",
      },
      { chainId: 42161, nonce: 1071, to: voucherProxy("VoucherEntitlementModule"), value: "500000000000000" },
      { chainId: 42161, nonce: 1072, to: voucherProxy("VoucherRedemptionModule"), value: "1000000000000000" },
      { chainId: 100, nonce: 16, to: voucherProxy("GnosisVoucherAdapter"), value: "250000000000000000" },
      { chainId: 100, nonce: 17, to: voucherProxy("GnosisVoucherEscrow"), value: "250000000000000000" },
    ].map((t) => ({ ...t, from: SENDER, data: "0x", kind: "fuel" })),
  );
  const plan = {
    sourceCommit: revision,
    operatorHash: keccak256(fs.readFileSync(self)),
    inputs,
    steward,
    vouchers,
    clc,
    transactions: txs,
  };
  const binding = canonical(plan);
  const providers = new Map<number, JsonRpcProvider>();
  const network = new NetworkManager();
  const journalPath = path.join(Q, "downstream.execution.json"),
    lockPath = path.join(Q, "downstream.execution.lock.json");
  if (fs.existsSync(journalPath) || fs.existsSync(lockPath))
    throw Error("Preserve existing downstream execution state and reconcile; no blind rerun");
  for (const chain of [42161, 100])
    if (fs.existsSync(path.join(CONTRACTS_ROOT, "deployments", chain + "-pilot-downstream.json")))
      throw Error("Preserve existing public downstream deployment artifact and reconcile");
  const bounds: any[] = [];
  const proofs: any[] = [];
  const packets: any[] = [];
  try {
    for (const chain of [42161, 100]) {
      console.log(
        `[downstream] Checking and rehearsing ${chain === 100 ? "Gnosis" : "Arbitrum"} deployments and owner packets`,
      );
      const rpc = network.getRpcUrl(chain === 100 ? "gnosis" : "arbitrum");
      const live = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
      providers.set(chain, live);
      same((await live.getNetwork()).chainId, chain, "Live chain");
      if (chain === 42161)
        writeReleaseJsonAtomic(path.join(Q, "source-upgrade-observed.json"), await sourceProof(live));
      const lane = txs.filter((t) => t.chainId === chain).sort((a, b) => a.nonce - b.nonce);
      for (const tag of ["latest", "pending"])
        same(await live.getTransactionCount(SENDER, tag), lane[0].nonce, "Live deployer nonce");
      if ((await live.getCode(SENDER)) !== "0x") throw Error("Approved deployer must remain an EOA");
      const current = inputs.vouchers.networks[chain === 100 ? "gnosis" : "arbitrum"];
      const peer = inputs.vouchers.networks[chain === 100 ? "arbitrum" : "gnosis"];
      same(
        await requiredCall(live, current.router, "function isChainSupported(uint64) view returns(bool)", [
          peer.selector,
        ]),
        true,
        "CCIP lane support",
      );
      if (chain === 42161) {
        same(
          await requiredCall(live, inputs.steward.hatsModule, "function owner() view returns(address)"),
          SENDER,
          "Hats observer authority",
        );
        const hats = new Contract(
          inputs.steward.hatsModule,
          [
            "function getGardenHatIds(address) view returns(uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)",
          ],
          live,
        );
        const ids = await hats.getGardenHatIds(inputs.steward.garden);
        same(ids[1], inputs.steward.stewardHat, "Canonical garden steward Hat");
        same(ids[7], true, "Configured garden");
      }
      const fork = await startIsolatedFork(rpc, chain);
      assertIsolatedRpc(fork.rpc);
      const p = new JsonRpcProvider(fork.rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
      p.pollingInterval = 10;
      try {
        if (chain === 100)
          for (const pin of Object.values(CLC_DEPENDENCIES))
            same(keccak256(await p.getCode(pin.address)), pin.runtimeHash, "CLC dependency runtime");
        await p.send("anvil_impersonateAccount", [SENDER]);
        await p.send("anvil_setBalance", [SENDER, toQuantity(10n ** 20n)]);
        let reserve = 0n;
        for (const t of lane) {
          if (t.address) same(await p.getCode(t.address), "0x", "Unused planned address");
          same(await p.getTransactionCount(SENDER, "pending"), t.nonce, "Fork nonce");
          const request = {
            from: SENDER,
            ...(t.to ? { to: t.to } : {}),
            data: t.data,
            value: toQuantity(BigInt(t.value)),
          };
          const estimate = await p.estimateGas(request);
          const gas = chain === 42161 ? (estimate * 150n) / 100n + 250000n : (estimate * 130n) / 100n + 1n;
          reserve += gas * fee(chain);
          const hash = await p.send("eth_sendTransaction", [
            { ...request, nonce: toQuantity(t.nonce), gas: toQuantity(gas) },
          ]);
          const receipt = await minedIsolatedReceipt(p, hash);
          if (receipt.status !== 1) throw Error("Rehearsal deployment failed");
          const runtimeHash = t.address ? keccak256(await p.getCode(t.address)) : null;
          if (t.address && runtimeHash === keccak256("0x")) throw Error("Missing rehearsed runtime");
          if (t.runtimeTemplate)
            same(
              keccak256(maskImmutableRuntime(await p.getCode(t.address!), t.immutableReferences)),
              keccak256(maskImmutableRuntime(t.runtimeTemplate, t.immutableReferences)),
              "Compiled runtime",
            );
          bounds.push({ chainId: chain, nonce: t.nonce, gasLimit: String(gas), runtimeHash });
        }
        if (reserve > cap(chain)) throw Error("Approved downstream native gas budget exceeded");
        if (
          (await live.getBalance(SENDER, "pending")) <
          reserve + (chain === 100 ? 900_000_000_000_000_000n : 3_000_000_000_000_000n)
        )
          throw Error("Funding required for remaining gas and reservations");
        await verifyEndpoints(p, plan, chain);
        const batches = await batchesFor(plan, p, chain);
        packets.push(...batches);
        for (const review of batches) {
          const pin =
            review.message.to.toLowerCase() === "0xa83c336b20401af773b6219ba5027174338d1836"
              ? "0xcdbdcec38d2f1c7d961b0029ff8416b7e86e9974d6f0e9c9580c7d17fcfb6663"
              : review.message.to.toLowerCase() === "0x40a2accbd92bca938b02010e17a5b8929b49130d"
                ? "0xa9865ac2d9c7a1591619b188c4d88167b50df6cc0c5327fcbd1c8c75f7c066ad"
                : "0xecd5bd14a08c5d2122379900b2f272bdf107a7e92423c10dd5fe3254386c9939";
          same(keccak256(await p.getCode(review.message.to)), pin, "Pinned batch helper");
          const snapshot = await p.send("evm_snapshot", []),
            ms = new Interface(["function multiSend(bytes)"]);
          const original = ms.decodeFunctionData("multiSend", review.message.data)[0];
          const badData = new Interface(["function changeThreshold(uint256)"]).encodeFunctionData(
            "changeThreshold",
            [0],
          );
          const extra = solidityPacked(
            ["uint8", "address", "uint256", "uint256", "bytes"],
            [0, review.safe, 0, (badData.length - 2) / 2, badData],
          );
          const bad = {
            ...review,
            message: {
              ...review.message,
              data: ms.encodeFunctionData("multiSend", [concat([original, extra])]),
            },
          };
          bad.safeTransactionHash = TypedDataEncoder.hash(review.domain, review.types, bad.message);
          let rejected = false;
          try {
            await ownerBatch(p, bad);
          } catch (e) {
            if (String((e as Error).message) !== "Exact atomic setup batch reverted") throw e;
            rejected = true;
          }
          if (!rejected) throw Error("Atomic rollback fault was accepted");
          same(
            await requiredCall(p, review.safe, "function nonce() view returns(uint256)"),
            review.nonce,
            "Failure rollback nonce",
          );
          await p.send("evm_revert", [snapshot]);
          const result = await ownerBatch(p, review);
          proofs.push({ ...result, atomicFailureRollback: true, retrySucceeded: true });
        }
      } finally {
        p.destroy();
        await fork.stop();
      }
    }
    writeReleaseJsonAtomic(path.join(Q, "downstream.plan.json"), plan);
    writeReleaseJsonAtomic(path.join(Q, "downstream.rehearsal.json"), {
      binding,
      bounds,
      proofs,
      packets,
      liveBroadcast: false,
    });
    if (!values.broadcast) {
      console.log("All deployments and three exact Safe batches rehearsed; no broadcast.");
      return;
    }
    const assertBindings = () => {
      same(
        releaseRevision(CONTRACTS_ROOT, path.join(CONTRACTS_ROOT, "config/steward-safe-release.json")),
        revision,
        "Release revision",
      );
      same(keccak256(fs.readFileSync(self)), plan.operatorHash, "Operator source");
      same(canonical(read(path.join(Q, "candidate-manifests.json"))), canonical(inputs), "Frozen inputs");
    };
    console.log(
      "[downstream] All 29 deployer transactions and 3 atomic owner packets rehearsed; one password entry follows",
    );
    assertBindings();
    const lock = fs.openSync(lockPath, "wx", 0o600);
    fs.writeFileSync(lock, JSON.stringify({ binding, pid: process.pid }));
    fs.closeSync(lock);
    const journal: any = { binding, completed: [], pending: null };
    const save = () => writeReleaseJsonAtomic(journalPath, journal);
    save();
    await withKeystorePassword(async (env, signal) => {
      same(
        execCastCaptured(
          ["wallet", "address", "--account", "green-goods-deployer"],
          { cwd: CONTRACTS_ROOT, env },
          "Deployer unlock",
        ).trim(),
        SENDER,
        "Keystore signer",
      );
      for (const t of txs) {
        signal.throwIfAborted();
        assertBindings();
        const p = providers.get(t.chainId)!;
        const b = bounds.find((x) => x.chainId === t.chainId && x.nonce === t.nonce)!;
        for (const tag of ["latest", "pending"])
          same(await p.getTransactionCount(SENDER, tag), t.nonce, "Broadcast nonce");
        if (t.address) same(await p.getCode(t.address), "0x", "Unused live address");
        if (t.chainId === 100 && t.nonce === inputs.steward.networks.gnosis.nonce) {
          const last = await requiredCall(
            p,
            "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137",
            "function lastTopHatId() view returns(uint256)",
          );
          same((BigInt(last) + 1n) << 224n, inputs.steward.expectedTopHat, "Current Hats root");
        }
        const liveGas = await p.estimateGas({
          from: SENDER,
          ...(t.to ? { to: t.to } : {}),
          data: t.data,
          value: BigInt(t.value),
          nonce: t.nonce,
        });
        if (liveGas > BigInt(b.gasLimit))
          throw Error("Live gas exceeds the rehearsed envelope; preserve the completed prefix and reconcile");
        journal.pending = { chainId: t.chainId, nonce: t.nonce, dataHash: keccak256(t.data) };
        save();
        const args = [
          "send",
          "--rpc-url",
          network.getRpcUrl(t.chainId === 100 ? "gnosis" : "arbitrum"),
          "--account",
          "green-goods-deployer",
          "--from",
          SENDER,
          "--nonce",
          String(t.nonce),
          "--gas-limit",
          b.gasLimit,
          "--gas-price",
          String(fee(t.chainId)),
          "--priority-gas-price",
          String(priority(t.chainId)),
          "--value",
          t.value,
          "--async",
          "--json",
          ...(t.to ? [t.to, t.data] : ["--create", t.data]),
        ];
        const hash = parseCastTransactionHash(
          execCastCaptured(args, { cwd: CONTRACTS_ROOT, env }, "Downstream deployment"),
          "Downstream deployment",
        );
        journal.pending.transactionHash = hash;
        save();
        const r = await p.waitForTransaction(hash, 1, 180000),
          sent = await p.getTransaction(hash);
        if (!r || !sent) throw Error("Receipt unavailable; retain pending state");
        same(sent.hash, hash, "Submitted transaction hash");
        assertDownstreamReceipt(t, b, sent, r, (await p.getBlock(r.blockNumber))?.hash);
        journal.completed.push({
          chainId: t.chainId,
          nonce: t.nonce,
          transactionHash: hash,
          blockNumber: r.blockNumber,
          blockHash: r.blockHash,
          status: r.status,
          actualCostWei: String(r.gasUsed * r.gasPrice),
        });
        save();
        if (r.status !== 1)
          throw Error("Deployment reverted; paid attempt retained; reconcile addresses before continuing");
        if (t.address) same(keccak256(await p.getCode(t.address)), b.runtimeHash, "Live deployment runtime");
        journal.pending = null;
        save();
        console.log(
          `[downstream] Receipt/runtime verified ${journal.completed.length}/29: chain ${t.chainId}, nonce ${t.nonce}, ${hash}`,
        );
      }
    });
    // Recheck the complete prefix before publishing artifacts or releasing owner packets.
    for (const evidence of journal.completed) {
      const p = providers.get(evidence.chainId)!;
      const t = txs.find((t) => t.chainId === evidence.chainId && t.nonce === evidence.nonce)!;
      const b = bounds.find((b) => b.chainId === evidence.chainId && b.nonce === evidence.nonce)!;
      const [receipt, sent] = await Promise.all([
        p.getTransactionReceipt(evidence.transactionHash),
        p.getTransaction(evidence.transactionHash),
      ]);
      if (!receipt || !sent || receipt.status !== 1) throw Error("Completed deployment receipt disappeared or failed");
      same(sent.hash, evidence.transactionHash, "Completed transaction hash");
      same(receipt.blockHash, evidence.blockHash, "Completed receipt block");
      assertDownstreamReceipt(t, b, sent, receipt, (await p.getBlock(receipt.blockNumber))?.hash);
      if (t.address) same(keccak256(await p.getCode(t.address)), b.runtimeHash, "Completed deployment runtime");
    }
    for (const chain of [42161, 100]) await verifyEndpoints(providers.get(chain)!, plan, chain);
    writeReleaseJsonAtomic(path.join(Q, "source-upgrade-observed.json"), await sourceProof(providers.get(42161)!));
    for (const chain of [42161, 100]) {
      writeReleaseJsonAtomic(path.join(CONTRACTS_ROOT, "deployments", chain + "-pilot-downstream.json"), {
        releaseId: "green-goods-tech-and-sun-voucher-pilot",
        chainId: chain,
        sourceCommit: revision,
        planHash: binding,
        deployer: SENDER,
        endpointOwner: GG,
        pauseGuardian: SENDER,
        contracts: txs
          .filter((t) => t.chainId === chain && t.address)
          .map((t) => ({
            contract: t.contract ?? t.component,
            address: t.address,
            runtimeHash: bounds.find((b) => b.chainId === chain && b.nonce === t.nonce).runtimeHash,
          })),
        receipts: journal.completed.filter((r: any) => r.chainId === chain),
        voucherEndpointsPaused: true,
        initialTokenSupply: "0",
        initialPoolInventory: "0",
        reserveAllowances: "0",
        techAndSunBootstrap: {
          safe: inputs.clc.techAndSunSafe,
          signer: AFO,
          initialThreshold: 1,
          finalThreshold: 2,
          finalization: "only approved bootstrap signer, after two authenticated steward owners",
        },
        issuerTermsAccepted: false,
        issuerCapacityConfirmed: false,
        ownerActivationPending: true,
      });
    }
    for (const packet of packets) {
      same(
        await requiredCall(providers.get(packet.chainId)!, packet.safe, "function nonce() view returns(uint256)"),
        packet.nonce,
        "Final Safe nonce",
      );
      exportPacket(packet);
    }
    fs.unlinkSync(lockPath);
    console.log(
      JSON.stringify(
        {
          state: "downstream-deployments-verified-safe-batches-exported",
          completed: journal.completed.length,
          batches: packets.map((p) => ({
            chainId: p.chainId,
            safe: p.safe,
            nonce: p.nonce,
            calls: p.calls.length,
            hash: p.safeTransactionHash,
            file: path.join(Q, p.file + ".safe-batch.json"),
          })),
          safeOwnerCallsBroadcast: false,
        },
        null,
        2,
      ),
    );
  } finally {
    for (const p of providers.values()) p.destroy();
  }
}
if (import.meta.main)
  main().catch((e) => {
    console.error(String(e?.message ?? "Downstream deployment failed").replace(/https?:\/\/[^\s]+/g, "[RPC]"));
    process.exitCode = 1;
  });
