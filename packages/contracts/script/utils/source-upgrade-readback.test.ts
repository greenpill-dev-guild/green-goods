import {
  Block,
  getAddress,
  Interface,
  JsonRpcProvider,
  keccak256,
  Network,
  Signature,
  toBeHex,
  TransactionReceipt,
  TransactionResponse,
  ZeroAddress,
  ZeroHash,
  type TransactionRequest,
} from "ethers";
import { afterEach, describe, expect, it, vi } from "vitest";
import draft from "../../config/source-upgrade-release.json";
import { SOURCE_EXECUTION_POLICY, SOURCE_SAFE_EXECUTION, sourceSafeTransactionHash } from "./source-upgrade-execution";
import type {
  SourceBoundaryEvidence,
  SourceExecutionContext,
  SourceExecutionJournal,
} from "./source-upgrade-execution-types";
import { createSourceUpgradeReadback, prepareSourceUpgradeBaseline } from "./source-upgrade-readback";
import {
  buildSourceUpgradePlan,
  SOURCE_IMPLEMENTATION_SLOT,
  SOURCE_SAFE_GUARD_SLOT,
  SOURCE_SAFE_MODULE_GUARD_SLOT,
  SOURCE_UPGRADE_TARGETS,
  type SourceUpgradeArtifacts,
  type SourceUpgradeManifest,
} from "./source-upgrade-release";
import { voucherDigest } from "./voucher-release";
const address = (n: number) => getAddress(toBeHex(n, 20)),
  hash = (n: number) => toBeHex(n, 32);
const sentinel = address(1),
  code = "0x6004",
  safeCode = "0x6001",
  singletonCode = "0x6002",
  oldCode = "0x6003";
const fields = [
  "hatsModule",
  "gardenToken",
  "commitmentRegistry",
  "actionRegistry",
  "workApprovalResolver",
  "eas",
  "workSchemaUID",
  "workApprovalSchemaUID",
  "legacyAssessmentSchemaUID",
  "assessmentV3SchemaUID",
  "nextPoolId",
  "nextCycleId",
  "nextCommitmentId",
  "nextCommitmentSeriesId",
  "protocolPoolId",
  "rootGarden",
  "commitmentPoolingModule",
  "protocolGarden",
  "gDollarToken",
  "gardenerDeliveryEnabled",
  "batchSizeLimit",
  "dispatcher",
  "feeReserveMinimum",
  "ccipRoute",
  "creditRegistry",
  "nativeFeeBalance",
];
const core = new Interface([
  "function owner() view returns(address)",
  "function paused() view returns(bool)",
  "function proxiableUUID() view returns(bytes32)",
  "function voucherServiceSetupModule() view returns(address)",
  "function serviceOfferProtocolVersion() view returns(uint256)",
  "function voucherAcceptanceProtocolVersion() view returns(uint256)",
  "function CCIP_ROUTER() view returns(address)",
  "function getRouter() view returns(address)",
  "function SOURCE_CHAIN_SELECTOR() view returns(uint64)",
  "function DESTINATION_EVM_CHAIN_ID() view returns(uint64)",
  ...fields.map((name) => `function ${name}() view returns(bytes32)`),
]);
const safe = new Interface([
  "function getOwners() view returns(address[])",
  "function getThreshold() view returns(uint256)",
  "function nonce() view returns(uint256)",
  "function getModulesPaginated(address,uint256) view returns(address[],address)",
]);
const providers: JsonRpcProvider[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  providers.splice(0).forEach((provider) => provider.destroy());
});
async function fixture(selectedSettlement = false) {
  const provider = new JsonRpcProvider(undefined, 42161, { staticNetwork: true, cacheTimeout: -1 });
  providers.push(provider);
  const manifest: SourceUpgradeManifest = {
    ...structuredClone(draft),
    schemaVersion: 1,
    chainId: 42161,
    deployer: address(90),
    nonce: 0,
    observation: { blockNumber: 100, blockHash: hash(100) },
    authority: { ...draft.authority, nonce: 5 },
    pooling: { proxy: address(70), implementation: address(71), implementationCodeHash: keccak256(oldCode) },
    settlement: selectedSettlement
      ? {
          ...draft.settlement!,
          proxy: address(72),
          implementation: address(73),
          implementationCodeHash: keccak256(oldCode),
        }
      : null,
  };
  const artifacts: SourceUpgradeArtifacts = {};
  for (const target of ["pooling", ...(selectedSettlement ? (["settlement"] as const) : [])] as const) {
    const key = SOURCE_UPGRADE_TARGETS[target],
      [source, name] = key.split(":");
    artifacts[key] = {
      abi: core.fragments.map((fragment) => JSON.parse(fragment.format("json"))),
      bytecode: { object: "0x60046000f3" },
      deployedBytecode: { object: code },
      metadata: {
        compiler: { version: "0.8.28" },
        settings: {
          compilationTarget: { [source]: name },
          optimizer: { enabled: true, runs: 1 },
          viaIR: true,
          evmVersion: "cancun",
        },
      },
    };
  }
  const plan = buildSourceUpgradePlan(manifest, artifacts, "a".repeat(40));
  const state = {
    prefix: 0,
    blockHash: hash(100),
    guard: ZeroAddress,
    moduleGuard: ZeroAddress,
    modules: [] as string[],
    moduleNext: sentinel,
    overrides: {} as Record<string, unknown>,
    codeOverrides: {} as Record<string, string>,
    peer: ZeroAddress,
    uuid: SOURCE_IMPLEMENTATION_SLOT,
    threshold: 2,
    singleton: address(80),
    drift: false,
    transactionPending: false,
    receiptMissing: false,
    receiptHash: hash(110),
  };
  const calls: Array<{ target: string; method: string; block: unknown }> = [];
  const completedCalls = (at: unknown) =>
    at === 100 ? [] : plan.ownerCalls.slice(0, Math.max(0, state.prefix - plan.deployments.length));
  const selected = (to: string) =>
    manifest.settlement &&
    [
      manifest.settlement.proxy,
      manifest.settlement.implementation,
      plan.deployments.find((d) => d.key === SOURCE_UPGRADE_TARGETS.settlement)!.address,
    ].includes(to)
      ? "settlement"
      : "pooling";
  vi.spyOn(provider, "getNetwork").mockResolvedValue(Network.from(42161));
  vi.spyOn(provider, "getTransactionCount").mockResolvedValue(9);
  vi.spyOn(provider, "getBlock").mockImplementation(async (tag) => {
    const number = typeof tag === "number" ? tag : 110;
    return new Block(
      {
        number,
        hash: number === 100 ? state.blockHash : state.receiptHash,
        timestamp: 1,
        parentHash: ZeroHash,
        nonce: "0x0000000000000000",
        difficulty: 0n,
        gasLimit: 1_000_000n,
        gasUsed: 0n,
        miner: ZeroAddress,
        extraData: "0x",
        baseFeePerGas: 1n,
        transactions: [],
      },
      provider,
    );
  });
  vi.spyOn(provider, "getCode").mockImplementation(
    async (to) =>
      state.codeOverrides[String(to)] ??
      (to === manifest.authority.address
        ? safeCode
        : to === address(80)
          ? singletonCode
          : to === manifest.deployer
            ? "0x"
            : [manifest.pooling.implementation, manifest.settlement?.implementation].includes(String(to))
              ? oldCode
              : code),
  );
  vi.spyOn(provider, "getStorage").mockImplementation(async (to, slot, at) => {
    if (to === manifest.authority.address)
      return toBeHex(
        BigInt(
          String(slot) === "0"
            ? state.singleton
            : String(slot) === SOURCE_SAFE_GUARD_SLOT
              ? state.guard
              : String(slot) === SOURCE_SAFE_MODULE_GUARD_SLOT
                ? state.moduleGuard
                : ZeroAddress,
        ),
        32,
      );
    const target = selected(String(to)),
      upgraded = completedCalls(at).some((call) => call.target === target && call.action === "upgrade");
    return toBeHex(
      BigInt(
        upgraded
          ? plan.deployments.find((d) => d.key === SOURCE_UPGRADE_TARGETS[target])!.address
          : manifest[target]!.implementation,
      ),
      32,
    );
  });
  vi.spyOn(provider, "call").mockImplementation(async (tx: TransactionRequest) => {
    const to = String(tx.to),
      abi = to === manifest.authority.address ? safe : core,
      fn = abi.getFunction(String(tx.data).slice(0, 10))!;
    calls.push({ target: to, method: fn.name, block: tx.blockTag });
    const target = selected(to),
      after = completedCalls(tx.blockTag);
    const values: Record<string, unknown> = {
      owner: manifest.authority.address,
      paused: after.some((call) => call.target === target && call.action === "pause"),
      getOwners: manifest.authority.owners,
      getThreshold: state.threshold,
      nonce: 5 + after.length,
      proxiableUUID: state.uuid,
      voucherServiceSetupModule: state.peer,
      serviceOfferProtocolVersion: 1,
      voucherAcceptanceProtocolVersion: 1,
      CCIP_ROUTER: manifest.settlement?.router,
      getRouter: manifest.settlement?.router,
      SOURCE_CHAIN_SELECTOR: manifest.settlement?.sourceSelector,
      DESTINATION_EVM_CHAIN_ID: manifest.settlement?.destinationChainId,
    };
    const value = Object.hasOwn(state.overrides, fn.name)
      ? state.overrides[fn.name]
      : Object.hasOwn(values, fn.name)
        ? values[fn.name]
        : state.drift && tx.blockTag !== 100
          ? hash(9)
          : ZeroHash;
    return abi.encodeFunctionResult(
      fn.name,
      fn.name === "getModulesPaginated" ? [state.modules, state.moduleNext] : [value],
    );
  });
  const pins = {
    runtimeHash: keccak256(safeCode),
    singleton: address(80),
    singletonRuntimeHash: keccak256(singletonCode),
  };
  const prepareBaseline = () =>
    prepareSourceUpgradeBaseline({
      provider,
      manifest,
      abis: { pooling: core, ...(selectedSettlement ? { settlement: core } : {}) },
      safePins: pins,
    });
  const baseline = await prepareBaseline();
  const runtime = {
    bindingHash: hash(4),
    deployments: plan.deployments.map((d) => ({
      key: d.key,
      address: d.address,
      runtimeHash: keccak256(code),
      compilerJobHash: hash(5),
    })),
  };
  const rehearsal = {
    planHash: voucherDigest(plan),
    sourceCommit: plan.sourceCommit,
    manifestHash: plan.manifestHash,
    runtimeBindingHash: runtime.bindingHash,
    deployments: runtime.deployments,
  };
  const envelope: SourceExecutionContext["envelope"] = {
    ...Object.fromEntries(Object.entries(SOURCE_EXECUTION_POLICY).map(([key, value]) => [key, String(value)])),
    chainId: 42161,
    planHash: voucherDigest(plan),
    manifestHash: plan.manifestHash,
    sourceCommit: plan.sourceCommit,
    artifactHashes: plan.artifactHashes,
    runtimeBindingHash: runtime.bindingHash,
    compilerJobHashes: Object.fromEntries(runtime.deployments.map((row) => [row.key, row.compilerJobHash])),
    rehearsalHash: voucherDigest(rehearsal),
    maxFeeWei: String(SOURCE_EXECUTION_POLICY.maxFeeWei),
    hatsSpentWei: String(SOURCE_EXECUTION_POLICY.hatsSpentWei),
    gasBudgetWei: String(SOURCE_EXECUTION_POLICY.gasBudgetWei),
    ccipBudgetWei: String(SOURCE_EXECUTION_POLICY.ccipBudgetWei),
    otherArbitrumReservedWei: "0",
    safePins: pins,
    baseline,
    boundaries: [
      ...plan.deployments.map((d) => ({ kind: "create" as const, nonce: d.nonce, runtimeHash: keccak256(code) })),
      ...plan.ownerCalls.map((call, i) => ({
        kind: "safe" as const,
        outerNonce: plan.deployments.length + i,
        safeNonce: call.safeNonce,
        safeTxGas: "0" as const,
        baseGas: "0" as const,
      })),
    ].map((boundary, i) => ({
      ...boundary,
      step: i + 1,
      from: manifest.deployer!,
      gasLimit: "100000",
      maxFeeWei: String(SOURCE_EXECUTION_POLICY.maxFeeWei),
      priorityFeeWei: "0",
    })),
  };
  const context = { plan, manifest, envelope, runtime, rehearsal };
  const journal: SourceExecutionJournal = {
    planHash: envelope.planHash,
    envelopeHash: voucherDigest(envelope),
    completed: [],
    attempts: {},
    pausedSnapshots: {},
  };
  const regenerateBindings = vi.fn(async () => ({ plan, runtime }));
  const port = createSourceUpgradeReadback({
    provider,
    context,
    journal: () => journal,
    abis: { pooling: core, ...(selectedSettlement ? { settlement: core } : {}) },
    regenerateBindings,
  });
  const receiptFor = (step: number) => {
    const boundary = envelope.boundaries[step - 1],
      call = plan.ownerCalls[step - plan.deployments.length - 1],
      safeHash = call && sourceSafeTransactionHash(call, boundary, manifest.authority.address);
    const event = safeHash ? SOURCE_SAFE_EXECUTION.encodeEventLog("ExecutionSuccess", [safeHash, 0]) : null;
    const receipt = new TransactionReceipt(
      {
        to: call ? manifest.authority.address : null,
        from: manifest.deployer!,
        contractAddress: call ? null : plan.deployments[step - 1].address,
        hash: hash(step),
        index: 0,
        blockHash: state.receiptHash,
        blockNumber: 110,
        logsBloom: "0x",
        gasUsed: 21000n,
        cumulativeGasUsed: 21000n,
        gasPrice: 7n,
        type: 2,
        status: 1,
        root: null,
        logs: event
          ? [
              {
                ...event,
                address: manifest.authority.address,
                transactionHash: hash(step),
                blockHash: state.receiptHash,
                blockNumber: 110,
                removed: false,
                index: 0,
                transactionIndex: 0,
              },
            ]
          : [],
      },
      provider,
    );
    return { receipt, boundary, call, safeHash };
  };
  vi.spyOn(provider, "getTransactionReceipt").mockImplementation(async (txHash) =>
    state.receiptMissing ? null : receiptFor(Number(BigInt(txHash))).receipt,
  );
  vi.spyOn(provider, "getTransaction").mockImplementation(async (txHash) => {
    const step = Number(BigInt(txHash)),
      { boundary, call } = receiptFor(step);
    return new TransactionResponse(
      {
        hash: txHash,
        index: 0,
        blockHash: state.transactionPending ? null : state.receiptHash,
        blockNumber: state.transactionPending ? null : 110,
        type: 2,
        to: call ? manifest.authority.address : null,
        from: manifest.deployer!,
        nonce: step - 1,
        gasLimit: BigInt(boundary.gasLimit),
        gasPrice: 7n,
        maxFeePerGas: SOURCE_EXECUTION_POLICY.maxFeeWei,
        maxPriorityFeePerGas: 0n,
        data: call
          ? SOURCE_SAFE_EXECUTION.encodeFunctionData("execTransaction", [
              call.to,
              0,
              call.data,
              0,
              0,
              0,
              0,
              ZeroAddress,
              ZeroAddress,
              "0x1234",
            ])
          : plan.deployments[step - 1].data,
        value: 0n,
        chainId: 42161n,
        signature: Signature.from({ r: hash(1), s: hash(2), v: 27 }),
        accessList: null,
        authorizationList: null,
      },
      provider,
    );
  });
  const evidence = (step: number): SourceBoundaryEvidence => ({
    step,
    transactionHash: hash(step),
    blockNumber: 110,
    blockHash: state.receiptHash,
    actualCostWei: "147000",
    ...(step <= plan.deployments.length
      ? { runtimeHash: keccak256(code) }
      : { safeTransactionHash: receiptFor(step).safeHash }),
  });
  return {
    provider,
    manifest,
    port,
    baseline,
    pins,
    context,
    journal,
    state,
    calls,
    regenerateBindings,
    evidence,
    prepareBaseline,
  };
}
describe("concrete read-only source upgrade readback", () => {
  it("normalizes real ethers receipt gasPrice and refuses pending transaction facts", async () => {
    const f = await fixture();
    expect(await f.port.getReceipt(hash(1))).toMatchObject({ gasPrice: 7n, gasUsed: 21000n, status: 1 });
    expect(await f.port.getTransaction(hash(1))).toMatchObject({
      nonce: 0,
      maxFeePerGas: 50000000n,
      from: f.manifest.deployer,
    });
    f.state.transactionPending = true;
    expect(await f.port.getTransaction(hash(1))).toBeNull();
    f.state.receiptMissing = true;
    expect(await f.port.getReceipt(hash(1))).toBeNull();
  });
  it("binds observation hashes and explicitly selected scalar getters", async () => {
    const f = await fixture();
    expect(Object.keys(f.baseline.sources)).toEqual(["pooling"]);
    expect(f.calls.every((call) => call.block === 100)).toBe(true);
    f.state.blockHash = hash(999);
    await expect(f.prepareBaseline()).rejects.toThrow("observation hash");
  });
  it("rejects a provider serving another chain", async () => {
    const f = await fixture();
    vi.mocked(f.provider.getNetwork).mockResolvedValueOnce(Network.from(100));
    await expect(f.prepareBaseline()).rejects.toThrow("chain");
  });
  it.each(["observation", "current"] as const)("rechecks %s block canonicality after reads", async (kind) => {
    const f = await fixture();
    const originalBlock = vi.mocked(f.provider.getBlock).getMockImplementation()!;
    vi.mocked(f.provider.getBlock).mockImplementationOnce(async (tag) => {
      const captured = await originalBlock(tag);
      if (kind === "observation") f.state.blockHash = hash(999);
      else f.state.receiptHash = hash(999);
      return captured;
    });
    await expect(kind === "observation" ? f.prepareBaseline() : f.port.assertCurrentPrefixState(0)).rejects.toThrow(
      "canonicality",
    );
  });
  it.each([
    "singleton",
    "guard",
    "moduleGuard",
    "modules",
    "moduleNext",
    "threshold",
  ] as const)("rejects Safe %s drift", async (kind) => {
    const f = await fixture();
    if (kind === "singleton") f.state.singleton = address(81);
    if (kind === "guard") f.state.guard = address(82);
    if (kind === "moduleGuard") f.state.moduleGuard = address(82);
    if (kind === "moduleNext") f.state.moduleNext = address(83);
    if (kind === "modules") f.state.modules = [address(83)];
    if (kind === "threshold") f.state.threshold = 1;
    await expect(f.port.assertCurrentPrefixState(0)).rejects.toThrow();
  });
  it("regenerates complete plan and compiler/runtime bindings before each next boundary", async () => {
    const f = await fixture();
    await f.port.assertPreconditions(1, f.journal);
    expect(f.regenerateBindings).toHaveBeenCalledOnce();
    f.regenerateBindings.mockResolvedValue({
      plan: { ...f.context.plan, sourceCommit: "b".repeat(40) },
      runtime: f.context.runtime,
    });
    await expect(f.port.assertPreconditions(1, f.journal)).rejects.toThrow("regenerated plan");
    f.regenerateBindings.mockResolvedValue({
      plan: f.context.plan,
      runtime: { ...f.context.runtime, bindingHash: hash(999) },
    });
    await expect(f.port.assertPreconditions(1, f.journal)).rejects.toThrow("regenerated runtime");
  });
  it("checks the entire current prefix and preserves an untouched settlement independently", async () => {
    const f = await fixture(true);
    f.state.prefix = 4;
    await expect(f.port.assertCurrentPrefixState(4)).resolves.toBeUndefined();
    f.state.peer = address(84);
    await expect(f.port.assertCurrentPrefixState(4)).rejects.toThrow("unbound voucher");
  });
  it.each([
    ["proxiableUUID", hash(12), "UUID"],
    ["CCIP_ROUTER", address(85), "CCIP_ROUTER"],
    ["getRouter", address(85), "getRouter"],
    ["SOURCE_CHAIN_SELECTOR", 1, "SOURCE_CHAIN_SELECTOR"],
    ["DESTINATION_EVM_CHAIN_ID", 1, "DESTINATION_EVM_CHAIN_ID"],
  ] as const)("rejects wrong Settlement %s", async (method, value, label) => {
    const f = await fixture(true);
    f.state.overrides[method] = value;
    await expect(f.port.verifyImplementationGetters(f.context.plan.deployments[1], f.manifest, 100)).rejects.toThrow(
      label,
    );
  });
  it("pins original runtime at observation and current prefix, then replacement runtime after adoption", async () => {
    const f = await fixture();
    f.state.codeOverrides[f.manifest.pooling.implementation] = "0x6009";
    await expect(f.prepareBaseline()).rejects.toThrow("implementation runtime");
    await expect(f.port.assertCurrentPrefixState(0)).rejects.toThrow("active runtime");
    delete f.state.codeOverrides[f.manifest.pooling.implementation];
    f.state.prefix = 3;
    f.state.codeOverrides[f.context.plan.deployments[0].address] = "0x6009";
    await expect(f.port.assertCurrentPrefixState(3)).rejects.toThrow("completed CREATE runtime");
  });
  it("does not charge or recurse when reverifying canonical CREATE evidence at a later prefix", async () => {
    const f = await fixture();
    f.state.prefix = 3;
    const before = structuredClone(f.journal);
    await f.port.reverifyCompleted(f.evidence(1), 3);
    expect(f.journal).toEqual(before);
    await expect(f.port.reverifyCompleted({ ...f.evidence(1), actualCostWei: "1" }, 3)).rejects.toThrow(
      "completed receipt evidence",
    );
  });
  it("reverifies superseded Safe pause evidence using the full prefix, not old block-end nonce/implementation", async () => {
    const f = await fixture();
    f.state.prefix = 3;
    f.journal.completed = [f.evidence(1), f.evidence(2), f.evidence(3)];
    f.journal.pausedSnapshots.pooling = {
      blockNumber: 110,
      blockHash: hash(110),
      preservedHash: voucherDigest(f.baseline.sources.pooling!.preserved),
    };
    const before = structuredClone(f.journal);
    await f.port.reverifyCompleted(f.evidence(2), 3);
    expect(f.journal).toEqual(before);
    f.state.receiptHash = hash(111);
    await expect(f.port.assertCurrentPrefixState(3)).rejects.toThrow("pause snapshot canonicality");
  });
  it("rejects selected getter drift without claiming mapping enumeration", async () => {
    const f = await fixture();
    f.state.drift = true;
    await expect(f.port.assertCurrentPrefixState(0)).rejects.toThrow("selected preserved getters");
  });
});
