import { AbiCoder, concat, getCreateAddress, id, keccak256, ZeroAddress } from "ethers";
import { describe, expect, it, vi } from "vitest";
import { voucherDigest } from "./voucher-release";
import { SOURCE_UPGRADE_TARGETS, type SourceUpgradeManifest, type SourceUpgradePlan } from "./source-upgrade-release";
import type {
  SourceExecutionContext,
  SourceBoundaryEvidence,
  SourceExecutionJournal,
  SourcePublicTransaction,
  SourcePublicReceipt,
  SourceSafeState,
} from "./source-upgrade-execution-types";
import {
  SOURCE_EXECUTION_POLICY as POLICY,
  SOURCE_SAFE_EXECUTION as SAFE,
  validateSourceExecutionEnvelope,
  sourceExecutionRemainingBudget,
  exportSourceSafeBoundary,
  sourceSafeTransactionHash,
  verifySourceExecutionBoundary,
  runSourceExecutionBoundary,
  verifySourceBoundaryEvidence,
} from "./source-upgrade-execution";

const address = (n: number) => `0x${BigInt(n).toString(16).padStart(40, "0")}`;
const hash = (n: number) => `0x${BigInt(n).toString(16).padStart(64, "0")}`;
const manifest: SourceUpgradeManifest = {
  schemaVersion: 1,
  releaseId: "source-execution-test",
  chainId: 42161,
  observation: { blockNumber: 200, blockHash: hash(200) },
  deployer: address(10),
  nonce: 1039,
  authority: { address: address(12), threshold: 2, owners: [1, 2, 3, 4, 5].map(address), nonce: 33 },
  pooling: { proxy: address(50), implementation: address(30), implementationCodeHash: hash(30) },
  settlement: {
    proxy: address(51),
    implementation: address(31),
    implementationCodeHash: hash(31),
    router: address(77),
    sourceSelector: "4949039107694359620",
    destinationChainId: "42220",
  },
};
const safeState: SourceSafeState = {
  runtimeHash: hash(31),
  singleton: address(32),
  singletonRuntimeHash: hash(33),
  owners: manifest.authority.owners,
  threshold: 2,
  nonce: 33,
  guard: ZeroAddress,
  moduleGuard: ZeroAddress,
  modules: [],
};
const proxyState = (target: "pooling" | "settlement") => ({
  owner: manifest.authority.address,
  implementation: manifest[target]!.implementation,
  paused: false,
  preserved: { counter: "0x03" },
});
function context(): SourceExecutionContext {
  const plan: SourceUpgradePlan = {
    schemaVersion: 1,
    kind: "PAUSED_EXISTING_SOURCE_UPGRADES",
    releaseId: manifest.releaseId,
    chainId: 42161,
    sourceCommit: "a".repeat(40),
    manifestHash: voucherDigest(manifest),
    artifactHashes: { a: hash(1) },
    deployments: Array.from({ length: 23 }, (_, i) => ({
      key: `library${i}`,
      kind: "library",
      from: manifest.deployer!,
      nonce: 1039 + i,
      address: getCreateAddress({ from: manifest.deployer!, nonce: 1039 + i }),
      to: null,
      data: "0x6000",
      value: "0",
      runtimeTemplate: "0x6000",
      immutableReferences: {},
    })),
    ownerCalls: ["pooling", "settlement"].flatMap((target, i) =>
      ["pause", "upgrade"].map((action, j) => ({
        target: target as "pooling" | "settlement",
        action: action as "pause" | "upgrade",
        from: manifest.authority.address,
        to: address(50 + i),
        data: action === "pause" ? "0x12345678" : "0x34567890",
        safeNonce: 33 + i * 2 + j,
        value: "0",
        operation: 0,
      })),
    ),
    endState: "paused-original-owner",
    activationIncluded: false,
    liveBroadcast: false,
  };
  plan.deployments[21].key = SOURCE_UPGRADE_TARGETS.pooling;
  plan.deployments[22].key = SOURCE_UPGRADE_TARGETS.settlement;
  const runtime = {
    bindingHash: hash(3),
    deployments: plan.deployments.map((d) => ({
      key: d.key,
      address: d.address,
      runtimeHash: keccak256("0x6000"),
      compilerJobHash: hash(4),
    })),
  };
  const rehearsal = {
    planHash: voucherDigest(plan),
    sourceCommit: plan.sourceCommit,
    manifestHash: plan.manifestHash,
    runtimeBindingHash: runtime.bindingHash,
    deployments: structuredClone(runtime.deployments),
  };
  return {
    plan,
    manifest: structuredClone(manifest),
    runtime,
    rehearsal,
    envelope: {
      chainId: 42161,
      planHash: voucherDigest(plan),
      manifestHash: plan.manifestHash,
      sourceCommit: plan.sourceCommit,
      artifactHashes: plan.artifactHashes,
      runtimeBindingHash: runtime.bindingHash,
      compilerJobHashes: Object.fromEntries(runtime.deployments.map((d) => [d.key, d.compilerJobHash])),
      rehearsalHash: voucherDigest(rehearsal),
      maxFeeWei: String(POLICY.maxFeeWei),
      hatsSpentWei: String(POLICY.hatsSpentWei),
      gasBudgetWei: String(POLICY.gasBudgetWei),
      ccipBudgetWei: String(POLICY.ccipBudgetWei),
      otherArbitrumReservedWei: "0",
      safePins: safeState,
      baseline: {
        observation: manifest.observation,
        safe: structuredClone(safeState),
        sources: { pooling: proxyState("pooling"), settlement: proxyState("settlement") },
      },
      boundaries: Array.from({ length: 27 }, (_, i) => ({
        step: i + 1,
        kind: i < 23 ? "create" : "safe",
        from: manifest.deployer!,
        nonce: 1039 + i,
        outerNonce: 1039 + i,
        safeNonce: 33 + i - 23,
        gasLimit: "100000",
        maxFeeWei: String(POLICY.maxFeeWei),
        priorityFeeWei: "0",
        safeTxGas: "0",
        baseGas: "0",
        runtimeHash: keccak256("0x6000"),
      })),
    },
  };
}
function fixture(safe = false) {
  const c = context(),
    step = safe ? 24 : 1,
    call = c.plan.ownerCalls[0],
    transactionHash = hash(100);
  const tx: SourcePublicTransaction = {
    hash: transactionHash,
    chainId: 42161n,
    from: manifest.deployer!,
    to: safe ? manifest.authority.address : null,
    nonce: safe ? 1062 : 1039,
    data: safe
      ? SAFE.encodeFunctionData("execTransaction", [
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
      : "0x6000",
    value: 0n,
    gasLimit: 100000n,
    maxFeePerGas: POLICY.maxFeeWei,
    maxPriorityFeePerGas: 0n,
    blockNumber: 300,
    blockHash: hash(300),
  };
  const event = SAFE.encodeEventLog(SAFE.getEvent("ExecutionSuccess")!, [independentSafeHash(call), 0]);
  const receipt: SourcePublicReceipt = {
    hash: transactionHash,
    status: 1,
    blockNumber: 300,
    blockHash: hash(300),
    gasUsed: 50000n,
    gasPrice: 10000000n,
    contractAddress: safe ? null : c.plan.deployments[0].address,
    logs: safe ? [{ address: manifest.authority.address, ...event }] : [],
  };
  const port = {
    revalidateBindings: vi.fn(async () => {}),
    assertPreconditions: vi.fn(async () => {}),
    reverifyCompleted: vi.fn(async (_evidence: SourceBoundaryEvidence, _prefix: number) => {}),
    getPendingNonce: vi.fn(async () => 1039),
    getChainId: vi.fn(async () => 42161),
    getTransaction: vi.fn(async () => tx),
    getReceipt: vi.fn(async () => receipt),
    getBlock: vi.fn(async () => ({ hash: hash(300) })),
    getCode: vi.fn(async () => "0x6000"),
    verifyImplementationGetters: vi.fn(async () => {}),
    getSafeState: vi.fn(async () => ({ ...safeState, nonce: 34 })),
    getProxyState: vi.fn(async () => ({ ...proxyState("pooling"), paused: true })),
    assertNewPeerPinsEmpty: vi.fn(async () => {}),
    assertCurrentPrefixState: vi.fn(async () => {}),
  };
  const recordMatchedAttempt = vi.fn(async () => {});
  const journal: SourceExecutionJournal = {
    planHash: voucherDigest(c.plan),
    envelopeHash: voucherDigest(c.envelope),
    completed: [],
    attempts: {},
    pausedSnapshots: {},
  };
  const writes: SourceExecutionJournal[] = [];
  const writeJournal = async (j: SourceExecutionJournal) => {
    writes.push(structuredClone(j));
  };
  return {
    ...c,
    step,
    expectedNonce: 1039,
    transactionHash,
    tx,
    receipt,
    port,
    recordMatchedAttempt,
    journal,
    writes,
    writeJournal,
  };
}
function independentSafeHash(call: SourceUpgradePlan["ownerCalls"][number]) {
  const abi = AbiCoder.defaultAbiCoder();
  const domain = keccak256(
    abi.encode(
      ["bytes32", "uint256", "address"],
      [id("EIP712Domain(uint256 chainId,address verifyingContract)"), 42161, manifest.authority.address],
    ),
  );
  const message = keccak256(
    abi.encode(
      [
        "bytes32",
        "address",
        "uint256",
        "bytes32",
        "uint8",
        "uint256",
        "uint256",
        "uint256",
        "address",
        "address",
        "uint256",
      ],
      [
        id(
          "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)",
        ),
        call.to,
        0,
        keccak256(call.data),
        0,
        0,
        0,
        0,
        ZeroAddress,
        ZeroAddress,
        call.safeNonce,
      ],
    ),
  );
  return keccak256(concat(["0x1901", domain, message]));
}
describe("source execution envelope", () => {
  it("binds 23 CREATE plus four outer Safe EOA nonces within the shared gas budget", () => {
    const f = fixture();
    expect(() => validateSourceExecutionEnvelope(f)).not.toThrow();
    expect(f.envelope.boundaries[23].outerNonce).toBe(1062);
    expect(POLICY.gasBudgetWei - POLICY.hatsSpentWei).toBe(4_924_821_914_270_000n);
  });
  it.each([
    [
      "plan",
      (f: SourceExecutionContext) => {
        f.envelope.planHash = hash(90);
      },
    ],
    [
      "manifest",
      (f: SourceExecutionContext) => {
        f.envelope.manifestHash = hash(90);
      },
    ],
    [
      "source",
      (f: SourceExecutionContext) => {
        f.envelope.sourceCommit = "b".repeat(40);
      },
    ],
    [
      "rehearsal",
      (f: SourceExecutionContext) => {
        f.envelope.rehearsalHash = hash(90);
      },
    ],
    [
      "compiler job",
      (f: SourceExecutionContext) => {
        f.envelope.compilerJobHashes.library0 = hash(90);
      },
    ],
    [
      "runtime binding",
      (f: SourceExecutionContext) => {
        f.envelope.runtimeBindingHash = hash(90);
      },
    ],
    [
      "fee cap",
      (f: SourceExecutionContext) => {
        f.envelope.maxFeeWei = "50000001";
      },
    ],
    [
      "Hats debit",
      (f: SourceExecutionContext) => {
        f.envelope.hatsSpentWei = "0";
      },
    ],
    [
      "Safe relayer",
      (f: SourceExecutionContext) => {
        f.envelope.boundaries[23].from = address(99);
      },
    ],
    [
      "outer nonce",
      (f: SourceExecutionContext) => {
        f.envelope.boundaries[23].outerNonce = 33;
      },
    ],
    [
      "remaining reservation",
      (f: SourceExecutionContext) => {
        f.envelope.otherArbitrumReservedWei = String(POLICY.gasBudgetWei);
      },
    ],
    [
      "baseline implementation",
      (f: SourceExecutionContext) => {
        f.envelope.baseline.sources.pooling!.implementation = address(90);
      },
    ],
    [
      "baseline observation",
      (f: SourceExecutionContext) => {
        f.envelope.baseline.observation = { blockNumber: 201, blockHash: hash(201) };
      },
    ],
  ])("rejects changed %s", (_name, mutate) => {
    const f = fixture();
    mutate(f);
    expect(() => validateSourceExecutionEnvelope(f)).toThrow();
  });
  it("hashes exact JSON bytes using the existing SHA256 digest, not canonical keccak", () => {
    const f = fixture();
    expect(voucherDigest({ a: 1, b: 2 })).not.toBe(voucherDigest({ b: 2, a: 1 }));
    f.envelope.artifactHashes = { foreign: hash(1) };
    expect(() => validateSourceExecutionEnvelope(f)).toThrow();
  });
  it("retains the planner's pooling-only shape rather than reserving four Safe calls", () => {
    const f = fixture();
    f.manifest.settlement = null;
    f.plan.deployments.pop();
    f.plan.ownerCalls.splice(2);
    f.runtime.deployments.pop();
    f.rehearsal.deployments.pop();
    f.plan.manifestHash = voucherDigest(f.manifest);
    f.envelope.planHash = f.rehearsal.planHash = voucherDigest(f.plan);
    f.envelope.manifestHash = f.rehearsal.manifestHash = f.plan.manifestHash;
    delete f.envelope.compilerJobHashes[SOURCE_UPGRADE_TARGETS.settlement];
    f.envelope.boundaries = [...f.envelope.boundaries.slice(0, 22), ...f.envelope.boundaries.slice(23, 25)].map(
      (b, i) => ({ ...b, step: i + 1, outerNonce: 1039 + i }),
    );
    f.envelope.rehearsalHash = voucherDigest(f.rehearsal);
    expect(() => validateSourceExecutionEnvelope(f)).not.toThrow();
    expect(f.envelope.boundaries).toHaveLength(24);
  });
  it("exports the exact Safe EIP712 recipe independently of outer relayer nonce", () => {
    const f = fixture(true),
      call = f.plan.ownerCalls[0],
      boundary = f.envelope.boundaries[23];
    expect(sourceSafeTransactionHash(call, boundary, manifest.authority.address)).toBe(independentSafeHash(call));
    expect(exportSourceSafeBoundary(call, boundary, manifest.authority.address)).toMatchObject({
      nonce: 33,
      gasPrice: "0",
      outer: { nonce: 1062, maxFeePerGas: "50000000" },
    });
  });
});
describe("source receipt adoption", () => {
  it("verifies exact CREATE runtime and records paid gas before promotion", async () => {
    const f = fixture();
    const result = await verifySourceExecutionBoundary(f);
    expect(result).toMatchObject({ runtimeHash: keccak256("0x6000"), actualCostWei: "500000000000" });
    expect(f.recordMatchedAttempt).toHaveBeenCalledOnce();
  });
  it("adopts only the exact direct Safe execution and paused selected source state", async () => {
    const f = fixture(true);
    expect(await verifySourceExecutionBoundary(f)).toMatchObject({
      safeTransactionHash: independentSafeHash(f.plan.ownerCalls[0]),
    });
  });
  it.each([
    [
      "nonce",
      (f: ReturnType<typeof fixture>) => {
        f.tx.nonce++;
      },
    ],
    [
      "native value",
      (f: ReturnType<typeof fixture>) => {
        f.tx.value = 1n;
      },
    ],
    [
      "fee cap",
      (f: ReturnType<typeof fixture>) => {
        f.tx.maxFeePerGas++;
      },
    ],
    [
      "calldata",
      (f: ReturnType<typeof fixture>) => {
        f.tx.data = "0x6001";
      },
    ],
    [
      "CREATE target",
      (f: ReturnType<typeof fixture>) => {
        f.tx.to = address(6);
      },
    ],
    [
      "RPC chain",
      (f: ReturnType<typeof fixture>) => {
        f.port.getChainId.mockResolvedValue(100);
      },
    ],
    [
      "block reorg",
      (f: ReturnType<typeof fixture>) => {
        f.port.getBlock.mockResolvedValue({ hash: hash(301) });
      },
    ],
    [
      "immutable runtime bytes",
      (f: ReturnType<typeof fixture>) => {
        f.port.getCode.mockResolvedValue("0x6001");
      },
    ],
    [
      "CREATE receipt address",
      (f: ReturnType<typeof fixture>) => {
        f.receipt.contractAddress = address(92);
      },
    ],
  ])("rejects wrong %s", async (_name, mutate) => {
    const f = fixture();
    mutate(f);
    await expect(verifySourceExecutionBoundary(f)).rejects.toThrow();
  });
  it.each([
    [
      "missing event",
      (f: ReturnType<typeof fixture>) => {
        f.receipt.logs = [];
      },
    ],
    [
      "duplicate event",
      (f: ReturnType<typeof fixture>) => {
        f.receipt.logs.push(f.receipt.logs[0]);
      },
    ],
    [
      "wrong Safe hash",
      (f: ReturnType<typeof fixture>) => {
        f.receipt.logs[0] = {
          address: manifest.authority.address,
          ...SAFE.encodeEventLog(SAFE.getEvent("ExecutionSuccess")!, [hash(98), 0]),
        };
      },
    ],
    [
      "delegatecall",
      (f: ReturnType<typeof fixture>) => {
        const c = f.plan.ownerCalls[0];
        f.tx.data = SAFE.encodeFunctionData("execTransaction", [
          c.to,
          0,
          c.data,
          1,
          0,
          0,
          0,
          ZeroAddress,
          ZeroAddress,
          "0x1234",
        ]);
      },
    ],
    [
      "refund",
      (f: ReturnType<typeof fixture>) => {
        const c = f.plan.ownerCalls[0];
        f.tx.data = SAFE.encodeFunctionData("execTransaction", [
          c.to,
          0,
          c.data,
          0,
          0,
          0,
          1,
          ZeroAddress,
          ZeroAddress,
          "0x1234",
        ]);
      },
    ],
    [
      "unpaused source",
      (f: ReturnType<typeof fixture>) => {
        f.port.getProxyState.mockResolvedValue(proxyState("pooling"));
      },
    ],
    [
      "threshold drift",
      (f: ReturnType<typeof fixture>) => {
        f.port.getSafeState.mockResolvedValue({ ...safeState, nonce: 34, threshold: 1 });
      },
    ],
    [
      "module authority",
      (f: ReturnType<typeof fixture>) => {
        f.port.getSafeState.mockResolvedValue({ ...safeState, nonce: 34, modules: [address(90)] });
      },
    ],
  ])("rejects Safe %s", async (_name, mutate) => {
    const f = fixture(true);
    mutate(f);
    await expect(verifySourceExecutionBoundary(f)).rejects.toThrow();
  });
  it("retains matching reverted gas as a paid attempt even though adoption fails", async () => {
    const f = fixture();
    f.receipt.status = 0;
    await expect(verifySourceExecutionBoundary(f)).rejects.toThrow("reverted");
    expect(f.recordMatchedAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ actualCostWei: "500000000000", status: 0 }),
    );
  });
  it("charges matched successful gas even when exact runtime verification fails", async () => {
    const f = fixture();
    f.port.getCode.mockResolvedValue("0x6001");
    await expect(verifySourceExecutionBoundary(f)).rejects.toThrow();
    expect(f.recordMatchedAttempt).toHaveBeenCalledOnce();
  });
  it("never charges an unrelated failed transaction to this release", async () => {
    const f = fixture();
    f.receipt.status = 0;
    f.tx.data = "0x6001";
    await expect(verifySourceExecutionBoundary(f)).rejects.toThrow();
    expect(f.recordMatchedAttempt).not.toHaveBeenCalled();
  });
  it("compares an upgrade to canonical paused selected getters and rechecks the whole current prefix", async () => {
    const f = fixture(true);
    const call = f.plan.ownerCalls[1];
    f.step = 25;
    f.tx.nonce = 1063;
    f.tx.data = SAFE.encodeFunctionData("execTransaction", [
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
    ]);
    f.receipt.logs = [
      {
        address: manifest.authority.address,
        ...SAFE.encodeEventLog(SAFE.getEvent("ExecutionSuccess")!, [independentSafeHash(call), 0]),
      },
    ];
    f.port.getSafeState.mockResolvedValue({ ...safeState, nonce: 35 });
    f.port.getProxyState.mockResolvedValue({
      ...proxyState("pooling"),
      implementation: f.plan.deployments[21].address,
      paused: true,
    });
    const pausedSnapshots = {
      pooling: { blockNumber: 299, blockHash: hash(299), preservedHash: voucherDigest({ counter: "0x03" }) },
    };
    const evidence = await verifySourceBoundaryEvidence({ ...f, pausedSnapshots, entirePrefixLength: 27 });
    expect(evidence.step).toBe(25);
    expect(f.recordMatchedAttempt).not.toHaveBeenCalled();
    expect(f.port.assertCurrentPrefixState).toHaveBeenLastCalledWith(27);
    pausedSnapshots.pooling.preservedHash = voucherDigest({ counter: "0x04" });
    await expect(verifySourceExecutionBoundary({ ...f, pausedSnapshots })).rejects.toThrow("preservation");
    expect(f.recordMatchedAttempt).toHaveBeenCalledOnce();
  });
  it("replays a known later same-block Safe prefix without accepting it as a new boundary", async () => {
    const f = fixture(true);
    f.port.getSafeState.mockResolvedValue({ ...safeState, nonce: 35 });
    f.port.getProxyState.mockResolvedValue({
      ...proxyState("pooling"),
      implementation: f.plan.deployments[21].address,
      paused: true,
    });
    await expect(verifySourceBoundaryEvidence({ ...f, entirePrefixLength: 25 })).resolves.toMatchObject({ step: 24 });
    expect(f.recordMatchedAttempt).not.toHaveBeenCalled();
    expect(f.port.assertCurrentPrefixState).toHaveBeenLastCalledWith(25);
    await expect(verifySourceExecutionBoundary(f)).rejects.toThrow("Safe nonce");
    expect(f.recordMatchedAttempt).toHaveBeenCalledOnce();
    f.port.assertCurrentPrefixState.mockRejectedValue(new Error("unknown future state"));
    await expect(verifySourceBoundaryEvidence({ ...f, entirePrefixLength: 25 })).rejects.toThrow("unknown future");
    await expect(verifySourceBoundaryEvidence({ ...f, entirePrefixLength: 28 })).rejects.toThrow("prefix");
  });
  it.each(["guard", "moduleGuard", "singleton"] as const)("rejects Safe %s authority drift", async (key) => {
    const f = fixture(true);
    f.port.getSafeState.mockResolvedValue({ ...safeState, nonce: 34, [key]: address(90) });
    await expect(verifySourceExecutionBoundary(f)).rejects.toThrow();
  });
});
describe("one-boundary journal", () => {
  it("exports Safe work without a signer, then adopts its external receipt without retaining signatures", async () => {
    const f = fixture(true);
    f.expectedNonce = 1062;
    for (let i = 0; i < 23; i++) {
      const evidence = {
        step: i + 1,
        transactionHash: hash(1000 + i),
        blockNumber: 299,
        blockHash: hash(299),
        actualCostWei: "500000000000",
        runtimeHash: keccak256("0x6000"),
      };
      f.journal.completed.push(evidence);
      f.journal.attempts[evidence.transactionHash] = {
        transactionHash: evidence.transactionHash,
        blockNumber: 299,
        blockHash: hash(299),
        actualCostWei: evidence.actualCostWei,
        status: 1,
      };
    }
    f.port.getPendingNonce.mockResolvedValue(1062);
    const operatorSubmitCreate = vi.fn();
    expect(await runSourceExecutionBoundary({ ...f, operatorSubmitCreate })).toMatchObject({
      state: "needs-external-safe-signatures",
      boundary: { nonce: 33, outer: { nonce: 1062 } },
    });
    expect(operatorSubmitCreate).not.toHaveBeenCalled();
    expect(f.writes).toHaveLength(0);
    await runSourceExecutionBoundary({ ...f, receiptHash: f.transactionHash, operatorSubmitCreate });
    expect(f.journal.completed).toHaveLength(24);
    expect(f.journal.pausedSnapshots.pooling?.preservedHash).toBe(voucherDigest({ counter: "0x03" }));
    expect(f.port.reverifyCompleted).toHaveBeenCalledWith(expect.objectContaining({ step: 1 }), 23);
    expect(JSON.stringify(f.journal)).not.toContain('"signatures"');
    expect(JSON.stringify(f.journal)).not.toContain("0x1234");
    expect(operatorSubmitCreate).not.toHaveBeenCalled();
  });
  it("strictly adopts a pending upgrade before rechecking its earlier same-block pause", async () => {
    const f = fixture(true);
    const call = f.plan.ownerCalls[1];
    f.step = 25;
    f.expectedNonce = f.tx.nonce = 1063;
    f.tx.data = SAFE.encodeFunctionData("execTransaction", [
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
    ]);
    f.receipt.logs = [
      {
        address: manifest.authority.address,
        ...SAFE.encodeEventLog(SAFE.getEvent("ExecutionSuccess")!, [independentSafeHash(call), 0]),
      },
    ];
    f.port.getSafeState.mockResolvedValue({ ...safeState, nonce: 35 });
    f.port.getProxyState.mockResolvedValue({
      ...proxyState("pooling"),
      implementation: f.plan.deployments[21].address,
      paused: true,
    });
    for (let i = 0; i < 24; i++) {
      const evidence = {
        step: i + 1,
        transactionHash: hash(1000 + i),
        blockNumber: 300,
        blockHash: hash(300),
        actualCostWei: "500000000000",
      };
      f.journal.completed.push(evidence);
      f.journal.attempts[evidence.transactionHash] = { ...evidence, status: 1 };
    }
    f.journal.pausedSnapshots.pooling = {
      blockNumber: 300,
      blockHash: hash(300),
      preservedHash: voucherDigest({ counter: "0x03" }),
    };
    f.journal.pending = {
      step: 25,
      from: f.tx.from,
      nonce: 1063,
      dataHash: keccak256(call.data),
      gasLimit: "100000",
      maxFeeWei: String(POLICY.maxFeeWei),
      transactionHash: f.transactionHash,
    };
    f.port.reverifyCompleted.mockImplementation(async (_evidence, prefix) => {
      expect(f.writes.at(-1)?.attempts[f.transactionHash]?.status).toBe(1);
      if (prefix !== 25) throw new Error("superseded pause state");
    });
    await expect(runSourceExecutionBoundary(f)).resolves.toMatchObject({ state: "verified" });
    expect(f.journal.completed).toHaveLength(25);
    expect(f.port.reverifyCompleted).toHaveBeenCalledTimes(24);
  });
  it("charges a matching reverted pending boundary before rejecting without rechecking an inferred future prefix", async () => {
    const f = fixture();
    f.receipt.status = 0;
    f.journal.pending = {
      step: 1,
      from: f.tx.from,
      nonce: 1039,
      dataHash: keccak256(f.tx.data),
      gasLimit: "100000",
      maxFeeWei: String(POLICY.maxFeeWei),
      transactionHash: f.transactionHash,
    };
    await expect(runSourceExecutionBoundary(f)).rejects.toThrow("reverted");
    expect(f.writes.at(-1)?.attempts[f.transactionHash]).toMatchObject({ status: 0, actualCostWei: "500000000000" });
    expect(f.journal.completed).toHaveLength(0);
    expect(f.journal.pending?.transactionHash).toBe(f.transactionHash);
    expect(f.port.reverifyCompleted).not.toHaveBeenCalled();
  });
  it("persists intent before one CREATE signer and never advances the next boundary", async () => {
    const f = fixture();
    const operatorSubmitCreate = vi.fn(async () => {
      expect(f.writes[0].pending).toBeDefined();
      expect(f.port.revalidateBindings).toHaveBeenCalledTimes(3);
      return f.transactionHash;
    });
    expect(await runSourceExecutionBoundary({ ...f, operatorSubmitCreate })).toMatchObject({ state: "verified" });
    expect(operatorSubmitCreate).toHaveBeenCalledOnce();
    expect(f.journal.completed).toHaveLength(1);
    expect(f.journal.pending).toBeUndefined();
    expect(Object.keys(f.journal.attempts)).toHaveLength(1);
  });
  it("adopts a canonical receipt after nonce advancement and never sends on replay", async () => {
    const f = fixture();
    f.port.getPendingNonce.mockResolvedValue(1040);
    const operatorSubmitCreate = vi.fn();
    const input = { ...f, receiptHash: f.transactionHash, operatorSubmitCreate };
    expect(await runSourceExecutionBoundary(input)).toMatchObject({ state: "verified" });
    expect(await runSourceExecutionBoundary(input)).toMatchObject({ state: "already-verified" });
    expect(operatorSubmitCreate).not.toHaveBeenCalled();
  });
  it("rejects live nonce drift before intent or signer", async () => {
    const f = fixture();
    f.port.getPendingNonce.mockResolvedValue(1040);
    const operatorSubmitCreate = vi.fn();
    await expect(runSourceExecutionBoundary({ ...f, operatorSubmitCreate })).rejects.toThrow("nonce drift");
    expect(f.writes).toHaveLength(0);
    expect(operatorSubmitCreate).not.toHaveBeenCalled();
  });
  it("requires exact receipt adoption for an ambiguous pre-submit intent", async () => {
    const f = fixture();
    f.journal.pending = {
      step: 1,
      nonce: 1039,
      from: manifest.deployer!,
      dataHash: keccak256("0x6000"),
      gasLimit: "100000",
      maxFeeWei: String(POLICY.maxFeeWei),
    };
    const operatorSubmitCreate = vi.fn();
    await expect(runSourceExecutionBoundary({ ...f, operatorSubmitCreate })).rejects.toThrow("ambiguous");
    await runSourceExecutionBoundary({ ...f, receiptHash: f.transactionHash });
    expect(operatorSubmitCreate).not.toHaveBeenCalled();
  });
  it("keeps a failed or interrupted signer intent locked against automatic retry", async () => {
    const f = fixture();
    const operatorSubmitCreate = vi.fn(async () => {
      throw new Error("unknown submit outcome");
    });
    await expect(runSourceExecutionBoundary({ ...f, operatorSubmitCreate })).rejects.toThrow("unknown submit");
    expect(f.writes[0].pending?.step).toBe(1);
    await expect(runSourceExecutionBoundary({ ...f, operatorSubmitCreate })).rejects.toThrow("ambiguous");
    expect(operatorSubmitCreate).toHaveBeenCalledOnce();
  });
  it("charges earlier paid attempts against all remaining reservations before prompting", async () => {
    const f = fixture();
    f.journal.attempts[hash(99)] = {
      transactionHash: hash(99),
      blockNumber: 299,
      blockHash: hash(299),
      actualCostWei: String(POLICY.gasBudgetWei - POLICY.hatsSpentWei),
      status: 0,
    };
    expect(() => sourceExecutionRemainingBudget(f.journal, f.envelope, 0)).toThrow();
    const operatorSubmitCreate = vi.fn();
    await expect(runSourceExecutionBoundary({ ...f, operatorSubmitCreate })).rejects.toThrow();
    expect(operatorSubmitCreate).not.toHaveBeenCalled();
  });
  it("recovers failed promotion from the durable hash and deduplicates charged gas", async () => {
    const f = fixture();
    let durable = structuredClone(f.journal);
    let fail = true;
    const writeJournal = async (j: SourceExecutionJournal) => {
      if (j.completed.length && fail) throw new Error("checkpoint write failed");
      durable = structuredClone(j);
    };
    const operatorSubmitCreate = vi.fn(async () => f.transactionHash);
    await expect(runSourceExecutionBoundary({ ...f, writeJournal, operatorSubmitCreate })).rejects.toThrow(
      "checkpoint write",
    );
    expect(durable.completed).toHaveLength(0);
    expect(durable.pending?.transactionHash).toBe(f.transactionHash);
    expect(Object.keys(durable.attempts)).toHaveLength(1);
    fail = false;
    await runSourceExecutionBoundary({ ...f, journal: durable, writeJournal });
    expect(Object.keys(durable.attempts)).toHaveLength(1);
    expect(operatorSubmitCreate).toHaveBeenCalledOnce();
  });
  it("blocks skipped prefix and a journal belonging to another envelope", async () => {
    const f = fixture();
    await expect(runSourceExecutionBoundary({ ...f, step: 2 })).rejects.toThrow();
    f.journal.envelopeHash = hash(98);
    await expect(runSourceExecutionBoundary(f)).rejects.toThrow();
  });
});
