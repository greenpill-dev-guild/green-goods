import {
  Block,
  getAddress,
  Interface,
  JsonRpcProvider,
  keccak256,
  Network,
  type TransactionRequest,
  toBeHex,
  ZeroAddress,
  ZeroHash,
} from "ethers";
import { afterEach, describe, expect, it, vi } from "vitest";
import draft from "../../config/source-upgrade-release.json";
import { validateSourceExecutionEnvelope } from "./source-upgrade-execution";
import { prepareSourceUpgradeExecution, type SourceUpgradePreparationInput } from "./source-upgrade-prepare";
import {
  buildSourceUpgradePlan,
  SOURCE_IMPLEMENTATION_SLOT,
  SOURCE_UPGRADE_TARGETS,
  type SourceUpgradeArtifacts,
  type SourceUpgradeManifest,
} from "./source-upgrade-release";
import { voucherDigest } from "./voucher-release";

const address = (n: number) => getAddress(toBeHex(n, 20));
const hash = (n: number) => toBeHex(n, 32);
const providers: JsonRpcProvider[] = [];
const scalarNames = [
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
  "function CCIP_ROUTER() view returns(address)",
  "function getRouter() view returns(address)",
  "function SOURCE_CHAIN_SELECTOR() view returns(uint64)",
  "function DESTINATION_EVM_CHAIN_ID() view returns(uint64)",
  ...scalarNames.map((name) => `function ${name}() view returns(bytes32)`),
]);
const safe = new Interface([
  "function getOwners() view returns(address[])",
  "function getThreshold() view returns(uint256)",
  "function nonce() view returns(uint256)",
  "function getModulesPaginated(address,uint256) view returns(address[],address)",
]);
afterEach(() => {
  vi.restoreAllMocks();
  for (const provider of providers.splice(0)) provider.destroy();
});
/** Public RPC responses only; actual baseline/readback/plan/envelope implementations remain unmocked. */
function fixture(full = true, initialNonce = 1039) {
  const provider = new JsonRpcProvider(undefined, 42161, { staticNetwork: true, cacheTimeout: -1 });
  providers.push(provider);
  const manifest: SourceUpgradeManifest = {
    ...structuredClone(draft),
    chainId: 42161,
    schemaVersion: 1,
    deployer: address(90),
    nonce: initialNonce,
    authority: { ...draft.authority, nonce: 33 },
    observation: { blockNumber: 100, blockHash: hash(100) },
    pooling: { proxy: address(70), implementation: address(71), implementationCodeHash: keccak256("0x6003") },
    settlement: full
      ? {
          ...draft.settlement,
          proxy: address(72),
          implementation: address(73),
          implementationCodeHash: keccak256("0x6003"),
        }
      : null,
  };
  const artifacts: SourceUpgradeArtifacts = {};
  const libraries = full ? Array.from({ length: 21 }, (_, i) => `src/lib/CommitmentPooling/Test${i}.sol:Test${i}`) : [];
  for (const key of [
    ...libraries,
    SOURCE_UPGRADE_TARGETS.pooling,
    ...(full ? [SOURCE_UPGRADE_TARGETS.settlement] : []),
  ]) {
    const [source, name] = key.split(":");
    artifacts[key] = {
      abi: [],
      bytecode: { object: "0x6000" },
      deployedBytecode: {
        object: `0x${"00".repeat(500)}`,
        ...(key === SOURCE_UPGRADE_TARGETS.pooling && full
          ? {
              linkReferences: Object.fromEntries(
                libraries.map((lib, i) => {
                  const [s, n] = lib.split(":");
                  return [s, { [n]: [{ start: i * 20, length: 20 }] }];
                }),
              ),
            }
          : {}),
      },
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
  const runtime = {
    bindingHash: voucherDigest({ fixture: "exact-runtime" }),
    deployments: plan.deployments.map((d) => ({
      key: d.key,
      address: d.address,
      runtimeHash: keccak256("0x6000"),
      compilerJobHash: voucherDigest({ fixture: "compiler" }),
    })),
  };
  const rehearsal = {
    planHash: voucherDigest(plan),
    sourceCommit: plan.sourceCommit,
    manifestHash: plan.manifestHash,
    runtimeBindingHash: runtime.bindingHash,
    deployments: structuredClone(runtime.deployments),
    proofClass: "owned-fork owner impersonation; no Safe signatures or live execution",
    forkBlock: 100,
    ownerCalls: [{ receipt: hash(1) }],
  };
  const state = { blockHash: hash(100), threshold: 2, modules: [] as string[], estimate: 100001n };
  const estimates: TransactionRequest[] = [];
  vi.spyOn(provider, "getNetwork").mockResolvedValue(Network.from(42161));
  vi.spyOn(provider, "getBlock").mockImplementation(
    async () =>
      new Block(
        {
          number: 100,
          hash: state.blockHash,
          timestamp: 1,
          parentHash: ZeroHash,
          nonce: "0x0000000000000000",
          difficulty: 0n,
          gasLimit: 100000000n,
          gasUsed: 0n,
          miner: ZeroAddress,
          extraData: "0x",
          baseFeePerGas: 1n,
          transactions: [],
        },
        provider,
      ),
  );
  vi.spyOn(provider, "getCode").mockImplementation(async (to) =>
    to === manifest.authority.address ? "0x6001" : to === address(80) ? "0x6002" : "0x6003",
  );
  vi.spyOn(provider, "getStorage").mockImplementation(async (to, slot) =>
    toBeHex(
      BigInt(
        to === manifest.authority.address
          ? String(slot) === "0"
            ? address(80)
            : ZeroAddress
          : to === manifest.pooling.proxy
            ? manifest.pooling.implementation
            : manifest.settlement!.implementation,
      ),
      32,
    ),
  );
  vi.spyOn(provider, "call").mockImplementation(async (tx) => {
    const abi = tx.to === manifest.authority.address ? safe : core;
    const fn = abi.getFunction(String(tx.data).slice(0, 10))!;
    const values: Record<string, unknown> = {
      owner: manifest.authority.address,
      paused: false,
      proxiableUUID: SOURCE_IMPLEMENTATION_SLOT,
      CCIP_ROUTER: manifest.settlement?.router,
      getRouter: manifest.settlement?.router,
      SOURCE_CHAIN_SELECTOR: manifest.settlement?.sourceSelector,
      DESTINATION_EVM_CHAIN_ID: manifest.settlement?.destinationChainId,
      getOwners: manifest.authority.owners,
      getThreshold: state.threshold,
      nonce: 33,
    };
    return abi.encodeFunctionResult(
      fn,
      fn.name === "getModulesPaginated" ? [state.modules, address(1)] : [values[fn.name] ?? ZeroHash],
    );
  });
  vi.spyOn(provider, "estimateGas").mockImplementation(async (tx) => {
    estimates.push(tx);
    return state.estimate;
  });
  const input: SourceUpgradePreparationInput = {
    plan,
    manifest,
    runtime,
    rehearsal,
    provider,
    abis: { pooling: core, ...(full ? { settlement: core } : {}) },
    safePins: { runtimeHash: keccak256("0x6001"), singleton: address(80), singletonRuntimeHash: keccak256("0x6002") },
    otherArbitrumReservedWei: "1000",
  };
  return { input, provider, state, estimates, rehearsal };
}
describe("source execution envelope preparation", () => {
  it("prices 23 exact CREATE requests and reserves four separately numbered Safe outer maxima", async () => {
    const f = fixture();
    const result = await prepareSourceUpgradeExecution(f.input);
    expect(f.estimates).toHaveLength(23);
    expect(f.estimates).toEqual(
      f.input.plan.deployments.map((d) => ({
        chainId: 42161,
        from: d.from,
        to: null,
        nonce: d.nonce,
        data: d.data,
        value: 0n,
        maxFeePerGas: 50000000n,
        maxPriorityFeePerGas: 0n,
      })),
    );
    expect(result.envelope.boundaries).toHaveLength(27);
    expect(result.envelope.boundaries.slice(0, 23).map((b) => b.nonce)).toEqual(
      Array.from({ length: 23 }, (_, i) => 1039 + i),
    );
    expect(result.envelope.boundaries.slice(23).map((b) => [b.outerNonce, b.safeNonce, b.gasLimit])).toEqual([
      [1062, 33, "2000000"],
      [1063, 34, "2000000"],
      [1064, 35, "2000000"],
      [1065, 36, "2000000"],
    ]);
    expect(result.gasQuotes.slice(23)).toEqual(
      [24, 25, 26, 27].map((step) => ({
        step,
        kind: "safe",
        gasLimit: "2000000",
        basis: "conservative-safe-outer-maximum",
      })),
    );
    expect(result.envelope.boundaries.slice(23).every((b) => b.safeTxGas === "0" && b.baseGas === "0")).toBe(true);
    expect(() => validateSourceExecutionEnvelope({ ...f.input, envelope: result.envelope })).not.toThrow();
  });
  it("binds full saved rehearsal, runtime/compiler/artifacts/manifest/source and canonical baseline", async () => {
    const f = fixture();
    const { envelope } = await prepareSourceUpgradeExecution(f.input);
    expect(envelope.rehearsalHash).toBe(voucherDigest(f.rehearsal));
    expect(envelope.planHash).toBe(voucherDigest(f.input.plan));
    expect(envelope.manifestHash).toBe(voucherDigest(f.input.manifest));
    expect(envelope.sourceCommit).toBe(f.input.plan.sourceCommit);
    expect(envelope.artifactHashes).toEqual(f.input.plan.artifactHashes);
    expect(envelope.compilerJobHashes).toEqual(
      Object.fromEntries(f.input.runtime.deployments.map((d) => [d.key, d.compilerJobHash])),
    );
    expect(envelope.baseline.observation).toEqual(f.input.manifest.observation);
    expect(envelope.baseline.sources.pooling?.owner).toBe(f.input.manifest.authority.address);
    expect(envelope.baseline.safe.threshold).toBe(2);
    expect(envelope.baseline.safe.owners).toEqual(f.input.manifest.authority.owners.map(getAddress));
  });
  it.each([
    [1n, "2"],
    [100n, "130"],
    [101n, "132"],
    [100001n, "130002"],
  ])("rounds the 30%% CREATE margin upward for %s gas", async (estimate, limit) => {
    const f = fixture(false);
    f.state.estimate = estimate as bigint;
    const result = await prepareSourceUpgradeExecution(f.input);
    expect(result.gasQuotes[0]).toEqual({
      step: 1,
      kind: "create",
      estimateGas: String(estimate),
      gasLimit: limit,
      basis: "estimate-plus-30-percent",
    });
  });
  it("retains approved fixed gas/CCIP caps and explicit other-component reservation", async () => {
    const f = fixture();
    const { envelope } = await prepareSourceUpgradeExecution(f.input);
    expect(envelope).toMatchObject({
      maxFeeWei: "50000000",
      hatsSpentWei: "75178085730000",
      gasBudgetWei: "5000000000000000",
      ccipBudgetWei: "2000000000000000",
      otherArbitrumReservedWei: "1000",
    });
    expect(envelope.boundaries.every((b) => b.maxFeeWei === "50000000" && b.priorityFeeWei === "0")).toBe(true);
  });
  it("accepts the exact inclusive shared cap and rejects one wei over including Safe maxima and Hats spend", async () => {
    const f = fixture();
    f.state.estimate = 100n;
    const available = 5000000000000000n - 75178085730000n - 23n * 130n * 50000000n - 8000000n * 50000000n;
    f.input.otherArbitrumReservedWei = String(available);
    await expect(prepareSourceUpgradeExecution(f.input)).resolves.toBeDefined();
    f.input.otherArbitrumReservedWei = String(available + 1n);
    await expect(prepareSourceUpgradeExecution(f.input)).rejects.toThrow(/budget exceeded/);
  });
  it.each([
    undefined,
    "",
    "-1",
    "1.5",
    "01",
  ])("refuses missing/noncanonical explicit other reservation %s", async (value) => {
    const f = fixture();
    f.input.otherArbitrumReservedWei = value as string;
    await expect(prepareSourceUpgradeExecution(f.input)).rejects.toThrow(/reservation/);
  });
  it.each([0n, -1n])("rejects invalid estimate %s without returning an envelope", async (estimate) => {
    const f = fixture();
    f.state.estimate = estimate;
    await expect(prepareSourceUpgradeExecution(f.input)).rejects.toThrow(/estimate/);
  });
  it("propagates provider rejection of future CREATE nonce instead of dropping nonce", async () => {
    const f = fixture();
    vi.mocked(f.provider.estimateGas).mockRejectedValue(new Error("future nonce unavailable"));
    await expect(prepareSourceUpgradeExecution(f.input)).rejects.toThrow("future nonce unavailable");
  });
  it("refuses a changed observation hash during estimation", async () => {
    const f = fixture();
    vi.mocked(f.provider.estimateGas).mockImplementation(async () => {
      f.state.blockHash = hash(101);
      return 100n;
    });
    await expect(prepareSourceUpgradeExecution(f.input)).rejects.toThrow(/canonical observation/);
  });
  it("refuses baseline authority drift before estimating", async () => {
    const f = fixture();
    f.state.threshold = 1;
    await expect(prepareSourceUpgradeExecution(f.input)).rejects.toThrow(/Safe threshold/);
    expect(f.estimates).toHaveLength(0);
  });
  it("rejects stale rehearsal/runtime evidence through the shared envelope validator", async () => {
    const f = fixture();
    f.input.rehearsal.runtimeBindingHash = hash(999);
    await expect(prepareSourceUpgradeExecution(f.input)).rejects.toThrow(/rehearsal runtime binding/);
  });
  it("rejects nonconsecutive CREATE nonce shape even when the stale rehearsal is rehashed", async () => {
    const f = fixture();
    f.input.plan.deployments[1].nonce++;
    f.input.rehearsal.planHash = voucherDigest(f.input.plan);
    await expect(prepareSourceUpgradeExecution(f.input)).rejects.toThrow(/CREATE nonce/);
  });
  it("rejects unsafe outer nonce overflow beyond the EOA CREATE prefix", async () => {
    const f = fixture(false, Number.MAX_SAFE_INTEGER - 1);
    await expect(prepareSourceUpgradeExecution(f.input)).rejects.toThrow(/nonce/);
  });
  it.each([
    [
      "CREATE native value",
      (f: ReturnType<typeof fixture>) => Object.assign(f.input.plan.deployments[0], { value: "1" }),
      /zero native value/,
    ],
    [
      "Safe native value",
      (f: ReturnType<typeof fixture>) => Object.assign(f.input.plan.ownerCalls[0], { value: "1" }),
      /direct zero-value/,
    ],
    [
      "Safe delegatecall",
      (f: ReturnType<typeof fixture>) => Object.assign(f.input.plan.ownerCalls[0], { operation: 1 }),
      /direct zero-value/,
    ],
    [
      "Safe nonce gap",
      (f: ReturnType<typeof fixture>) => {
        f.input.plan.ownerCalls[1].safeNonce++;
      },
      /nonce separation/,
    ],
  ] as const)("rejects a mutated %s recipe", async (_name, mutate, error) => {
    const f = fixture();
    mutate(f);
    f.input.rehearsal.planHash = voucherDigest(f.input.plan);
    await expect(prepareSourceUpgradeExecution(f.input)).rejects.toThrow(error);
  });
  it("does not alias the caller's mutable binding objects after preparation", async () => {
    const f = fixture();
    const { envelope } = await prepareSourceUpgradeExecution(f.input);
    const recorded = structuredClone(envelope);
    f.input.plan.artifactHashes.changed = "changed";
    f.input.safePins.singleton = address(999);
    f.input.manifest.observation.blockHash = hash(999);
    expect(envelope).toEqual(recorded);
  });
});
