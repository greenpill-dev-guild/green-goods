import { getCreateAddress, keccak256, Wallet, ZeroAddress } from "ethers";
import { OPERATOR } from "../cli/operations.mjs";
import { SOURCE_EXECUTION_POLICY } from "./source-upgrade-execution";
import type {
  SourceExecutionContext,
  SourceExecutionJournal,
  SourceExecutionReadPort,
} from "./source-upgrade-execution-types";
import { voucherDigest } from "./voucher-release";
import { SOURCE_SAFE_EXECUTION, sourceSafeTransactionHash, sourceSafeTypedData } from "./source-upgrade-safe-execution";
import { sourceSafeSignature, sourceSafeSignedCalldata } from "./source-upgrade-safe-signing";

const address = (n: number) => `0x${(0x1000000000000000000000000000000000000000n + BigInt(n)).toString(16)}`;
const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
/** Synthetic owners only; these public fixture keys never correspond to operator credentials. */
export async function sourceSafeSigningFixture() {
  const wallets = [1, 2, 3, 4, 5].map((n) => new Wallet(hash(n)));
  const manifest: SourceExecutionContext["manifest"] = {
    schemaVersion: 1,
    releaseId: "safe-signing-test",
    chainId: 42161,
    observation: { blockNumber: 100, blockHash: hash(100) },
    deployer: OPERATOR,
    nonce: 1039,
    authority: { address: address(12), threshold: 2, owners: wallets.map((w) => w.address), nonce: 0 },
    pooling: { proxy: address(50), implementation: address(30), implementationCodeHash: hash(30) },
    settlement: null,
  };
  const plan: SourceExecutionContext["plan"] = {
    schemaVersion: 1,
    kind: "PAUSED_EXISTING_SOURCE_UPGRADES",
    releaseId: manifest.releaseId,
    chainId: 42161,
    sourceCommit: "a".repeat(40),
    manifestHash: voucherDigest(manifest),
    artifactHashes: { library: hash(1) },
    deployments: [
      {
        key: "library",
        kind: "library",
        address: getCreateAddress({ from: OPERATOR, nonce: 1039 }),
        from: OPERATOR,
        nonce: 1039,
        to: null,
        value: "0",
        data: "0x6000",
        runtimeTemplate: "0x6000",
        immutableReferences: {},
      },
    ],
    ownerCalls: ["pause", "upgrade"].map((action, i) => ({
      target: "pooling",
      action: action as "pause" | "upgrade",
      from: manifest.authority.address,
      to: address(50),
      data: "0x12345678",
      value: "0",
      operation: 0,
      safeNonce: i,
    })),
    endState: "paused-original-owner",
    activationIncluded: false,
    liveBroadcast: false,
  };
  const runtime = {
    bindingHash: hash(3),
    deployments: [
      {
        key: "library",
        address: plan.deployments[0].address,
        runtimeHash: keccak256("0x6000"),
        compilerJobHash: hash(4),
      },
    ],
  };
  const rehearsal = {
    planHash: voucherDigest(plan),
    sourceCommit: plan.sourceCommit,
    manifestHash: plan.manifestHash,
    runtimeBindingHash: runtime.bindingHash,
    deployments: runtime.deployments,
  };
  const safe = {
    runtimeHash: hash(31),
    singleton: address(32),
    singletonRuntimeHash: hash(33),
    owners: manifest.authority.owners,
    threshold: 2,
    nonce: 0,
    guard: ZeroAddress,
    moduleGuard: ZeroAddress,
    modules: [],
  };
  const proxy = {
    owner: manifest.authority.address,
    implementation: manifest.pooling.implementation!,
    paused: false,
    preserved: { count: "0x03" },
  };
  const context: SourceExecutionContext = {
    plan,
    manifest,
    runtime,
    rehearsal,
    envelope: {
      chainId: 42161,
      planHash: voucherDigest(plan),
      manifestHash: plan.manifestHash,
      sourceCommit: plan.sourceCommit,
      artifactHashes: plan.artifactHashes,
      runtimeBindingHash: runtime.bindingHash,
      compilerJobHashes: { library: hash(4) },
      rehearsalHash: voucherDigest(rehearsal),
      maxFeeWei: String(SOURCE_EXECUTION_POLICY.maxFeeWei),
      hatsSpentWei: String(SOURCE_EXECUTION_POLICY.hatsSpentWei),
      gasBudgetWei: String(SOURCE_EXECUTION_POLICY.gasBudgetWei),
      ccipBudgetWei: String(SOURCE_EXECUTION_POLICY.ccipBudgetWei),
      otherArbitrumReservedWei: "0",
      safePins: safe,
      baseline: { observation: manifest.observation, safe, sources: { pooling: proxy } },
      boundaries: [
        {
          step: 1,
          kind: "create",
          from: OPERATOR,
          nonce: 1039,
          gasLimit: "100000",
          maxFeeWei: "50000000",
          priorityFeeWei: "0",
          runtimeHash: keccak256("0x6000"),
        },
        ...[0, 1].map((i) => ({
          step: i + 2,
          kind: "safe" as const,
          from: OPERATOR,
          outerNonce: 1040 + i,
          safeNonce: i,
          gasLimit: "2000000",
          maxFeeWei: "50000000",
          priorityFeeWei: "0" as const,
          safeTxGas: "0" as const,
          baseGas: "0" as const,
        })),
      ],
    },
  };
  const typed = sourceSafeTypedData(plan.ownerCalls[0], context.envelope.boundaries[1], manifest.authority.address);
  const signatures = await Promise.all(
    wallets
      .slice(0, 2)
      .map(async (w) =>
        sourceSafeSignature(
          context,
          2,
          await w.signTypedData(typed.domain, { SafeTx: typed.types.SafeTx }, typed.message),
        ),
      ),
  );
  const data = sourceSafeSignedCalldata(context, 2, signatures);
  const event = SOURCE_SAFE_EXECUTION.encodeEventLog(SOURCE_SAFE_EXECUTION.getEvent("ExecutionSuccess")!, [
    sourceSafeTransactionHash(plan.ownerCalls[0], context.envelope.boundaries[1], manifest.authority.address),
    0,
  ]);
  const journal: SourceExecutionJournal = {
    planHash: voucherDigest(plan),
    envelopeHash: voucherDigest(context.envelope),
    completed: [
      {
        step: 1,
        transactionHash: hash(1),
        blockNumber: 101,
        blockHash: hash(101),
        actualCostWei: "1",
        runtimeHash: keccak256("0x6000"),
      },
    ],
    attempts: {
      [hash(1)]: { transactionHash: hash(1), blockNumber: 101, blockHash: hash(101), actualCostWei: "1", status: 1 },
    },
    pausedSnapshots: {},
  };
  const port: SourceExecutionReadPort = {
    revalidateBindings: async () => {},
    assertPreconditions: async () => {},
    reverifyCompleted: async () => {},
    getPendingNonce: async () => 1040,
    getChainId: async () => 42161,
    getTransaction: async () => ({
      hash: hash(2),
      chainId: 42161n,
      from: OPERATOR,
      to: manifest.authority.address,
      nonce: 1040,
      data,
      value: 0n,
      gasLimit: 2000000n,
      maxFeePerGas: 50000000n,
      maxPriorityFeePerGas: 0n,
      blockNumber: 102,
      blockHash: hash(102),
    }),
    getReceipt: async () => ({
      hash: hash(2),
      status: 1,
      blockNumber: 102,
      blockHash: hash(102),
      gasUsed: 50000n,
      gasPrice: 10000000n,
      contractAddress: null,
      logs: [{ address: manifest.authority.address, ...event }],
    }),
    getBlock: async (n) => ({ hash: hash(n) }),
    getCode: async () => "0x6000",
    getSafeState: async () => ({ ...safe, nonce: 1 }),
    getProxyState: async () => ({ ...proxy, paused: true }),
    verifyImplementationGetters: async () => {},
    assertNewPeerPinsEmpty: async () => {},
    assertCurrentPrefixState: async () => {},
  };
  return { context, wallets, signatures, data, typed, journal, port, transactionHash: hash(2) };
}
