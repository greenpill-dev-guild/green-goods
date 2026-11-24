import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Interface, type JsonRpcProvider, zeroPadValue } from "ethers";
import draft from "../../config/clc-garden-exchanges.json";
import { buildCLCGardenPlan } from "./clc-garden-release";
import {
  gardenExecutionJournal,
  validateGardenExecutionJournal,
  gardenRegistration,
  verifyGardenExecutionReceipts,
  executeGardenDeployment,
  recoverGardenExecutionJournal,
  GARDEN_MAX_FEE,
} from "./clc-garden-execution";
import { assertGardenLiveRpc, persistGardenDeploymentEvidence } from "./clc-garden-downstream";
import { getCLCProxyRuntime } from "./clc-member-readback";
import { CLC_FACTORY_ABI } from "./clc-release";

const revision = "a".repeat(40);
const plan = buildCLCGardenPlan(
  { ...draft, deployer: "0x0000000000000000000000000000000000000042", nonce: 7 },
  revision,
);
describe("garden downstream execution boundary", () => {
  it("binds the journal to exact plan, manifest and committed source", () => {
    const journal = gardenExecutionJournal(plan);
    validateGardenExecutionJournal(journal, plan);
    for (const changed of [
      { ...journal, planHash: "bad" },
      { ...journal, sourceCommit: "b".repeat(40) },
      { ...journal, evidence: "isolated-fork" },
      { ...journal, chainId: 42161 },
    ])
      expect(() => validateGardenExecutionJournal(changed, plan)).toThrow();
  });
  it("rejects unknown, non-prefix and unbound pending transactions", () => {
    const journal = gardenExecutionJournal(plan);
    expect(() =>
      validateGardenExecutionJournal({ ...journal, transactions: { unknown: "0x" + "1".repeat(64) } }, plan),
    ).toThrow();
    expect(() =>
      validateGardenExecutionJournal(
        { ...journal, transactions: { [plan.transactions[1].component]: "0x" + "1".repeat(64) } },
        plan,
      ),
    ).toThrow();
    expect(() =>
      validateGardenExecutionJournal(
        { ...journal, pending: { component: plan.transactions[0].component, nonce: 99, transactionHash: null } },
        plan,
      ),
    ).toThrow();
  });
  it("cannot register a simulated, incomplete, or mismatched deployment", () => {
    const journal = gardenExecutionJournal(plan);
    expect(() => gardenRegistration(plan, journal, [])).toThrow();
    expect(() => gardenRegistration(plan, { ...journal, evidence: "isolated-fork" } as never, [])).toThrow();
  });
  it("produces all six receipt-backed Shared pins and the exact indexer start block", async () => {
    const f = receiptsFixture();
    const receipts = await verifyGardenExecutionReceipts(f.provider, plan, f.journal);
    const artifact = gardenRegistration(plan, f.journal, receipts);
    expect(artifact.indexerRegistration.address).toBe(plan.pools.techAndSun.addresses.pool);
    expect(artifact.indexerRegistration.startBlock).toBe(105);
    const registration = artifact.appRegistration.pool;
    expect(registration.registry.address).toBe(plan.pools.techAndSun.addresses.index);
    expect(registration.deployment.factoryDeployment.initializer).toBe(plan.transactions[5].initializer);
    expect(registration.deployment.implementation.runtimeCodeHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(artifact.appRegistration.activationIncluded).toBe(false);
    expect(() =>
      gardenRegistration(
        plan,
        f.journal,
        receipts.map((row) => ({ ...row, address: plan.assets[0].token })),
      ),
    ).toThrow();
  });
  it.each([
    "chain",
    "nonce",
    "calldata",
    "canonical",
    "runtime",
    "admin",
    "implementation",
    "fee",
  ])("rejects %s drift before registration", async (fault) => {
    const f = receiptsFixture();
    if (fault === "chain") f.state.chain = 42161n;
    if (fault === "nonce") f.transactions[0].nonce++;
    if (fault === "calldata") f.transactions[0].data = "0x00";
    if (fault === "canonical") f.state.canonical = false;
    if (fault === "runtime") f.state.code = "0x6000";
    if (fault === "admin") f.state.admin = plan.transactions[0].from;
    if (fault === "implementation") f.state.implementation = plan.transactions[0].from;
    if (fault === "fee") f.transactions[0].maxFeePerGas = GARDEN_MAX_FEE + 1n;
    await expect(verifyGardenExecutionReceipts(f.provider, plan, f.journal)).rejects.toThrow();
  });
  it("rejects a changed manifest and pending ambiguous send without invoking a signer", async () => {
    const f = receiptsFixture();
    let sent = 0;
    const options = {
      provider: f.provider,
      plan,
      manifest: { ...draft, deployer: plan.transactions[0].from, nonce: 7 },
      revision,
      journal: gardenExecutionJournal(plan),
      save: () => {},
      assertBindings: () => {},
      send: async () => {
        sent++;
        return "0x" + "1".repeat(64);
      },
    };
    await expect(
      executeGardenDeployment({ ...options, manifest: { ...options.manifest, nonce: 8 } } as never),
    ).rejects.toThrow();
    options.journal.pending = { component: plan.transactions[0].component, nonce: 7, transactionHash: null };
    await expect(executeGardenDeployment(options as never)).rejects.toThrow("Pending");
    expect(sent).toBe(0);
  });
  it("rejects local fork endpoints even when they report chain 100", async () => {
    const f = receiptsFixture();
    await expect(assertGardenLiveRpc(f.provider, "http://127.0.0.1:8545")).rejects.toThrow("non-loopback");
    const fork = { ...f.provider, send: async () => ({}) } as unknown as JsonRpcProvider;
    await expect(assertGardenLiveRpc(fork, "https://example.org/rpc")).rejects.toThrow("Fork evidence");
  });
  it("refreshes adopted balances without rewriting immutable deployment identity", async () => {
    const f = receiptsFixture();
    const receipts = await verifyGardenExecutionReceipts(f.provider, plan, f.journal);
    const deployment = gardenRegistration(plan, f.journal, receipts);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "garden-registration-test-"));
    try {
      const artifactPath = path.join(directory, "deployment.json"),
        readbackPath = path.join(directory, "readback.json");
      persistGardenDeploymentEvidence(artifactPath, readbackPath, {
        deployment,
        readback: { reserveBalance: "10000000" },
      });
      const original = fs.readFileSync(artifactPath, "utf8");
      persistGardenDeploymentEvidence(artifactPath, readbackPath, {
        deployment,
        readback: { reserveBalance: "9000000" },
      });
      expect(fs.readFileSync(artifactPath, "utf8")).toBe(original);
      expect(JSON.parse(fs.readFileSync(readbackPath, "utf8")).reserveBalance).toBe("9000000");
      expect(() =>
        persistGardenDeploymentEvidence(artifactPath, readbackPath, {
          deployment: { ...deployment, planHash: "changed" },
          readback: {},
        }),
      ).toThrow("identity differs");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
  it("recovers an explicit canonical replacement and records the original submitted hash", async () => {
    const f = receiptsFixture();
    f.state.deployedCount = 1;
    const journal = gardenExecutionJournal(plan);
    const previousHash = `0x${"f".repeat(64)}`;
    journal.pending = { component: plan.transactions[0].component, nonce: 7, transactionHash: previousHash };
    const recovered = await recoverGardenExecutionJournal(f.provider, plan, journal, {
      transactions: { [plan.transactions[0].component]: f.transactions[0].hash },
    });
    expect(recovered.pending).toBeNull();
    expect(recovered.replacements).toEqual([
      { component: plan.transactions[0].component, previousHash, transactionHash: f.transactions[0].hash },
    ]);
    expect(journal.pending.transactionHash).toBe(previousHash);
    f.transactions[0].data = "0x00";
    await expect(
      recoverGardenExecutionJournal(f.provider, plan, journal, { transactions: recovered.transactions }),
    ).rejects.toThrow("calldata");
  });
});

function receiptsFixture() {
  const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
  const journal = gardenExecutionJournal(plan);
  const transactions = plan.transactions.map((tx, i) => ({
    ...tx,
    hash: hash(i + 1),
    chainId: 100n,
    value: 0n,
    blockNumber: 100 + i,
    blockHash: hash(100 + i),
    gasLimit: 200_000n,
    maxFeePerGas: GARDEN_MAX_FEE,
  }));
  for (const tx of transactions) journal.transactions[tx.component] = tx.hash;
  const state = {
    deployedCount: plan.transactions.length,
    chain: 100n,
    canonical: true,
    code: getCLCProxyRuntime(),
    admin: null as string | null,
    implementation: null as string | null,
  };
  const abi = new Interface(CLC_FACTORY_ABI);
  const provider = {
    getNetwork: async () => ({ chainId: state.chain }),
    getTransaction: async (h: string) => transactions.find((row) => row.hash === h),
    getTransactionReceipt: async (h: string) => {
      const tx = transactions.find((row) => row.hash === h)!;
      return { ...tx, status: 1, contractAddress: null, gasUsed: 100_000n, gasPrice: GARDEN_MAX_FEE };
    },
    getBlock: async (n: number) => ({ hash: state.canonical ? hash(n) : hash(999) }),
    getCode: async (address: string) =>
      transactions.findIndex((row) => row.address.toLowerCase() === address.toLowerCase()) < state.deployedCount
        ? state.code
        : "0x",
    getStorage: async (address: string) =>
      zeroPadValue(
        state.implementation ??
          transactions.find((tx) => tx.address.toLowerCase() === address.toLowerCase())!.implementation,
        32,
      ),
    call: async (request: { data: string }) => {
      const parsed = abi.parseTransaction(request)!;
      const tx = transactions.find((row) => row.address.toLowerCase() === parsed.args[0].toLowerCase())!;
      return abi.encodeFunctionResult("adminOf", [state.admin ?? tx.admin]);
    },
  } as unknown as JsonRpcProvider;
  return { journal, transactions, state, provider };
}
