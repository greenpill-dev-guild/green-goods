import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { getCreateAddress, keccak256, ZeroAddress } from "ethers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSourceExecutionStore, SOURCE_EXECUTION_FILES } from "./source-upgrade-execution-store";
import { SOURCE_EXECUTION_POLICY } from "./source-upgrade-execution";
import { voucherDigest } from "./voucher-release";
import type {
  SourceExecutionContext,
  SourceExecutionReadPort,
  SourceExecutionJournal,
} from "./source-upgrade-execution-types";

const address = (n: number) => `0x${BigInt(n).toString(16).padStart(40, "0")}`;
const hash = (n: number) => `0x${BigInt(n).toString(16).padStart(64, "0")}`;
const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "source-execution-store-"));
  directories.push(directory);
  const manifest: SourceExecutionContext["manifest"] = {
    schemaVersion: 1,
    releaseId: "store-test",
    chainId: 42161,
    observation: { blockNumber: 200, blockHash: hash(200) },
    deployer: address(10),
    nonce: 1039,
    authority: { address: address(12), threshold: 2, owners: [1, 2, 3, 4, 5].map(address), nonce: 33 },
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
    artifactHashes: { a: hash(1) },
    deployments: [
      {
        key: "library",
        kind: "library",
        from: address(10),
        nonce: 1039,
        address: getCreateAddress({ from: address(10), nonce: 1039 }),
        to: null,
        data: "0x6000",
        value: "0",
        runtimeTemplate: "0x6000",
        immutableReferences: {},
      },
    ],
    ownerCalls: ["pause", "upgrade"].map((action, index) => ({
      target: "pooling",
      action: action as "pause" | "upgrade",
      from: address(12),
      to: address(50),
      data: "0x12345678",
      safeNonce: 33 + index,
      value: "0",
      operation: 0,
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
      safePins: { runtimeHash: hash(31), singleton: address(32), singletonRuntimeHash: hash(33) },
      baseline: {
        observation: manifest.observation,
        safe: {
          runtimeHash: hash(31),
          singleton: address(32),
          singletonRuntimeHash: hash(33),
          owners: manifest.authority.owners,
          threshold: 2,
          nonce: 33,
          guard: ZeroAddress,
          moduleGuard: ZeroAddress,
          modules: [],
        },
        sources: {
          pooling: { implementation: address(30), owner: address(12), paused: false, preserved: { count: "0x03" } },
        },
      },
      boundaries: Array.from({ length: 3 }, (_, index) => ({
        step: index + 1,
        kind: index ? "safe" : "create",
        from: address(10),
        nonce: 1039 + index,
        outerNonce: 1039 + index,
        safeNonce: 32 + index,
        gasLimit: "100000",
        maxFeeWei: String(SOURCE_EXECUTION_POLICY.maxFeeWei),
        priorityFeeWei: "0",
        safeTxGas: "0",
        baseGas: "0",
        runtimeHash: keccak256("0x6000"),
      })),
    },
  };
  const transactionHash = hash(100);
  const port: SourceExecutionReadPort = {
    revalidateBindings: vi.fn(async () => {}),
    assertPreconditions: vi.fn(async () => {}),
    reverifyCompleted: vi.fn(async () => {}),
    getPendingNonce: vi.fn(async () => 1039),
    getChainId: vi.fn(async () => 42161),
    getTransaction: vi.fn(async () => ({
      hash: transactionHash,
      chainId: 42161n,
      from: address(10),
      to: null,
      nonce: 1039,
      data: "0x6000",
      value: 0n,
      gasLimit: 100000n,
      maxFeePerGas: 50000000n,
      maxPriorityFeePerGas: 0n,
      blockNumber: 300,
      blockHash: hash(300),
    })),
    getReceipt: vi.fn(async () => ({
      hash: transactionHash,
      status: 1 as const,
      blockNumber: 300,
      blockHash: hash(300),
      gasUsed: 50000n,
      gasPrice: 10000000n,
      contractAddress: plan.deployments[0].address,
      logs: [],
    })),
    getBlock: vi.fn(async () => ({ hash: hash(300) })),
    getCode: vi.fn(async () => "0x6000"),
    getSafeState: vi.fn(),
    getProxyState: vi.fn(),
    verifyImplementationGetters: vi.fn(async () => {}),
    assertNewPeerPinsEmpty: vi.fn(async () => {}),
    assertCurrentPrefixState: vi.fn(async () => {}),
  };
  const store = createSourceExecutionStore({ directory, context });
  const boundary = { step: 1, expectedNonce: 1039, port };
  return { directory, context, transactionHash, port, store, boundary };
}
async function leavePending(f: ReturnType<typeof fixture>) {
  await expect(
    f.store.executeBoundary({
      ...f.boundary,
      operatorSubmitCreate: async () => {
        throw new Error("unknown submit");
      },
    }),
  ).rejects.toThrow("unknown submit");
  return f.store.readJournal();
}
function deadOwner(f: ReturnType<typeof fixture>) {
  const result = spawnSync("/usr/bin/true");
  expect(result.status).toBe(0);
  const claim = JSON.parse(fs.readFileSync(f.store.paths.lock, "utf8"));
  claim.pid = result.pid;
  fs.writeFileSync(f.store.paths.lock, JSON.stringify(claim));
}
describe("source execution filesystem store", () => {
  it("atomically persists one boundary and releases only its completed claim", async () => {
    const f = fixture();
    expect(Object.values(f.store.paths).map((file) => path.basename(file))).toEqual(
      Object.values(SOURCE_EXECUTION_FILES),
    );
    const signer = vi.fn(async () => {
      expect(f.store.readJournal().pending?.step).toBe(1);
      expect(fs.statSync(f.store.paths.lock).mode & 0o777).toBe(0o600);
      return f.transactionHash;
    });
    await expect(f.store.executeBoundary({ ...f.boundary, operatorSubmitCreate: signer })).resolves.toMatchObject({
      state: "verified",
    });
    expect(signer).toHaveBeenCalledOnce();
    expect(f.store.readJournal().completed).toHaveLength(1);
    expect(f.store.readJournal().attempts[f.transactionHash]?.actualCostWei).toBe("500000000000");
    expect(fs.existsSync(f.store.paths.lock)).toBe(false);
  });
  it("does not let a caller redirect the fixed chain journal and lock paths", () => {
    const f = fixture();
    const original = f.store.paths.journal;
    expect(Reflect.set(f.store.paths, "journal", path.join(f.directory, "other.json"))).toBe(false);
    expect(f.store.paths.journal).toBe(original);
    expect(Object.isFrozen(SOURCE_EXECUTION_FILES)).toBe(true);
  });
  it("rejects a concurrent process claim while the first signer is awaiting a result", async () => {
    const f = fixture();
    let release!: (hash: string) => void;
    const result = f.store.executeBoundary({
      ...f.boundary,
      operatorSubmitCreate: () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    });
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    const second = createSourceExecutionStore({ directory: f.directory, context: f.context });
    await expect(second.executeBoundary(f.boundary)).rejects.toThrow();
    expect(second.readJournal().pending?.step).toBe(1);
    release(f.transactionHash);
    await result;
  });
  it("releases a pre-intent validation failure but permanently retains the journal identity", async () => {
    const f = fixture();
    vi.mocked(f.port.getPendingNonce).mockResolvedValue(1040);
    await expect(f.store.executeBoundary(f.boundary)).rejects.toThrow("nonce drift");
    expect(fs.existsSync(f.store.paths.lock)).toBe(false);
    expect(fs.existsSync(f.store.paths.journal)).toBe(true);
    const changed = structuredClone(f.context);
    changed.envelope.otherArbitrumReservedWei = "1";
    expect(() => createSourceExecutionStore({ directory: f.directory, context: changed }).readJournal()).toThrow(
      "binding",
    );
  });
  it("retains an uncertain intent and rejects live-PID recovery without a second signer", async () => {
    const f = fixture();
    await leavePending(f);
    expect(fs.existsSync(f.store.paths.lock)).toBe(true);
    await expect(f.store.executeBoundary(f.boundary)).rejects.toThrow();
    await expect(f.store.recoverBoundary({ ...f.boundary, receiptHash: f.transactionHash })).rejects.toThrow("alive");
    expect(f.store.readJournal().pending?.transactionHash).toBeUndefined();
  });
  it("adopts a dead process's exact receipt with no signer and removes both exact claims", async () => {
    const f = fixture();
    await leavePending(f);
    deadOwner(f);
    await expect(f.store.recoverBoundary({ ...f.boundary, receiptHash: f.transactionHash })).resolves.toMatchObject({
      state: "verified",
    });
    expect(f.store.readJournal().pending).toBeUndefined();
    expect(f.store.readJournal().completed).toHaveLength(1);
    expect(fs.existsSync(f.store.paths.lock)).toBe(false);
    expect(fs.existsSync(f.store.paths.recoveryLock)).toBe(false);
  });
  it("keeps the main lock but releases its own recovery guard on a not-yet-mined receipt", async () => {
    const f = fixture();
    await leavePending(f);
    deadOwner(f);
    const original = fs.readFileSync(f.store.paths.lock, "utf8");
    vi.mocked(f.port.getReceipt).mockResolvedValueOnce(null);
    await expect(f.store.recoverBoundary({ ...f.boundary, receiptHash: f.transactionHash })).rejects.toThrow(
      "unavailable",
    );
    expect(fs.readFileSync(f.store.paths.lock, "utf8")).toBe(original);
    expect(fs.existsSync(f.store.paths.recoveryLock)).toBe(false);
    await expect(f.store.recoverBoundary({ ...f.boundary, receiptHash: f.transactionHash })).resolves.toMatchObject({
      state: "verified",
    });
  });
  it("preserves a paid matching failed post-state and supports later explicit adoption only", async () => {
    const f = fixture();
    vi.mocked(f.port.getCode).mockResolvedValue("0x6001");
    await expect(f.store.executeBoundary({ ...f.boundary, receiptHash: f.transactionHash })).rejects.toThrow("runtime");
    expect(f.store.readJournal().attempts[f.transactionHash]?.status).toBe(1);
    expect(fs.existsSync(f.store.paths.lock)).toBe(true);
    deadOwner(f);
    vi.mocked(f.port.getCode).mockResolvedValue("0x6000");
    await f.store.recoverBoundary({ ...f.boundary, receiptHash: f.transactionHash });
    expect(Object.keys(f.store.readJournal().attempts)).toHaveLength(1);
  });
  it("retains a canonically matching reverted payment without promoting or automatically retrying", async () => {
    const f = fixture();
    const receipt = await f.port.getReceipt(f.transactionHash);
    vi.mocked(f.port.getReceipt).mockResolvedValue({ ...receipt!, status: 0 });
    await expect(f.store.executeBoundary({ ...f.boundary, receiptHash: f.transactionHash })).rejects.toThrow(
      "reverted",
    );
    expect(f.store.readJournal().attempts[f.transactionHash]).toMatchObject({
      status: 0,
      actualCostWei: "500000000000",
    });
    expect(f.store.readJournal().completed).toHaveLength(0);
    const signer = vi.fn();
    await expect(f.store.executeBoundary({ ...f.boundary, operatorSubmitCreate: signer })).rejects.toThrow();
    expect(signer).not.toHaveBeenCalled();
  });
  it("never removes a replaced original main claim during recovery", async () => {
    const f = fixture();
    await leavePending(f);
    deadOwner(f);
    vi.mocked(f.port.getCode).mockImplementation(async () => {
      fs.writeFileSync(f.store.paths.lock, "replacement main claim");
      return "0x6000";
    });
    await expect(f.store.recoverBoundary({ ...f.boundary, receiptHash: f.transactionHash })).rejects.toThrow("claim");
    expect(fs.readFileSync(f.store.paths.lock, "utf8")).toBe("replacement main claim");
    expect(fs.existsSync(f.store.paths.recoveryLock)).toBe(false);
  });
  it("leaves a replaced recovery guard untouched even when its own cleanup fails", async () => {
    const f = fixture();
    await leavePending(f);
    deadOwner(f);
    const main = fs.readFileSync(f.store.paths.lock, "utf8");
    vi.mocked(f.port.getCode).mockImplementation(async () => {
      fs.writeFileSync(f.store.paths.recoveryLock, "replacement guard");
      return "0x6000";
    });
    await expect(f.store.recoverBoundary({ ...f.boundary, receiptHash: f.transactionHash })).rejects.toThrow("claim");
    expect(fs.readFileSync(f.store.paths.lock, "utf8")).toBe(main);
    expect(fs.readFileSync(f.store.paths.recoveryLock, "utf8")).toBe("replacement guard");
  });
  it("refuses a stale recovery guard rather than recursively clearing it", async () => {
    const f = fixture();
    await leavePending(f);
    deadOwner(f);
    fs.writeFileSync(f.store.paths.recoveryLock, "crashed recovery", { flag: "wx" });
    await expect(f.store.recoverBoundary({ ...f.boundary, receiptHash: f.transactionHash })).rejects.toThrow();
    expect(fs.readFileSync(f.store.paths.recoveryLock, "utf8")).toBe("crashed recovery");
    expect(fs.existsSync(f.store.paths.lock)).toBe(true);
  });
  it("blocks ordinary execution when a crashed recovery guard remains even without a main lock", async () => {
    const f = fixture();
    fs.writeFileSync(f.store.paths.recoveryLock, "crashed after main lock release", { flag: "wx" });
    const signer = vi.fn();
    await expect(f.store.executeBoundary({ ...f.boundary, operatorSubmitCreate: signer })).rejects.toThrow(
      "recovery guard",
    );
    expect(signer).not.toHaveBeenCalled();
    expect(fs.existsSync(f.store.paths.recoveryLock)).toBe(true);
  });
  it("releases only its new main claim if a recovery guard appears during acquisition", async () => {
    const f = fixture();
    const original = fs.openSync.bind(fs);
    vi.spyOn(fs, "openSync").mockImplementation((file, flags, mode) => {
      const fd = original(file, flags, mode);
      if (String(file) === f.store.paths.lock && typeof flags === "number" && flags & fs.constants.O_EXCL)
        fs.writeFileSync(f.store.paths.recoveryLock, "racing recovery", { flag: "wx" });
      return fd;
    });
    const signer = vi.fn();
    await expect(f.store.executeBoundary({ ...f.boundary, operatorSubmitCreate: signer })).rejects.toThrow(
      "recovery guard appeared",
    );
    expect(signer).not.toHaveBeenCalled();
    expect(fs.existsSync(f.store.paths.lock)).toBe(false);
    expect(fs.readFileSync(f.store.paths.recoveryLock, "utf8")).toBe("racing recovery");
  });
  it("releases its exact claim after successful Safe export without changing history", async () => {
    const f = fixture();
    await f.store.executeBoundary({ ...f.boundary, receiptHash: f.transactionHash });
    const before = fs.readFileSync(f.store.paths.journal, "utf8");
    vi.mocked(f.port.getPendingNonce).mockResolvedValue(1040);
    await expect(f.store.executeBoundary({ ...f.boundary, step: 2, expectedNonce: 1040 })).resolves.toMatchObject({
      state: "needs-external-safe-signatures",
    });
    expect(fs.readFileSync(f.store.paths.journal, "utf8")).toBe(before);
    expect(fs.existsSync(f.store.paths.lock)).toBe(false);
  });
  it("never removes a replaced lock identity after a successful chain read", async () => {
    const f = fixture();
    const signer = async () => {
      fs.unlinkSync(f.store.paths.lock);
      fs.writeFileSync(f.store.paths.lock, "another claimant", { flag: "wx" });
      return f.transactionHash;
    };
    await expect(f.store.executeBoundary({ ...f.boundary, operatorSubmitCreate: signer })).rejects.toThrow("claim");
    expect(fs.readFileSync(f.store.paths.lock, "utf8")).toBe("another claimant");
  });
  it("rejects an unknown signer capability even on a structurally untyped recovery call", async () => {
    const f = fixture();
    await leavePending(f);
    deadOwner(f);
    const signer = vi.fn();
    const input = { ...f.boundary, receiptHash: f.transactionHash, operatorSubmitCreate: signer };
    await expect(f.store.recoverBoundary(input as never)).rejects.toThrow("signer");
    expect(signer).not.toHaveBeenCalled();
  });
  it.each(["journal", "lock", "recoveryLock"] as const)("rejects a symlinked %s path", async (key) => {
    const f = fixture();
    const outside = path.join(f.directory, "outside.json");
    fs.writeFileSync(outside, "{}\n");
    fs.symlinkSync(outside, f.store.paths[key]);
    await expect(f.store.executeBoundary(f.boundary)).rejects.toThrow();
    expect(fs.readFileSync(outside, "utf8")).toBe("{}\n");
  });
  it("rejects a dangling journal symlink and a symlinked parent directory", () => {
    const f = fixture();
    fs.symlinkSync(path.join(f.directory, "absent.json"), f.store.paths.journal);
    expect(() => f.store.readJournal()).toThrow();
    const alias = `${f.directory}-alias`;
    fs.symlinkSync(f.directory, alias);
    directories.push(alias);
    expect(() => createSourceExecutionStore({ directory: alias, context: f.context }).readJournal()).toThrow();
  });
  it.each([
    { planHash: hash(1) },
    { completed: [], attempts: [], pausedSnapshots: {} },
    { completed: [{ step: 2 }], attempts: {}, pausedSnapshots: {} },
    { completed: [], attempts: { [hash(1)]: { transactionHash: hash(1), actualCostWei: "-1" } }, pausedSnapshots: {} },
  ])("fails closed on an incomplete or corrupt journal", (bad) => {
    const f = fixture();
    fs.writeFileSync(f.store.paths.journal, JSON.stringify({ ...f.store.readJournal(), ...bad }));
    expect(() => f.store.readJournal()).toThrow();
  });
  it("keeps the prior complete journal when atomic intent persistence fails before rename", async () => {
    const f = fixture();
    const original = fs.renameSync.bind(fs);
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (String(to) === f.store.paths.journal && JSON.parse(fs.readFileSync(from, "utf8")).pending)
        throw new Error("intent rename failed");
      original(from, to);
    });
    syncBuiltinESMExports();
    const signer = vi.fn();
    await expect(f.store.executeBoundary({ ...f.boundary, operatorSubmitCreate: signer })).rejects.toThrow(
      "intent rename",
    );
    expect(f.store.readJournal().pending).toBeUndefined();
    expect(f.store.readJournal().completed).toHaveLength(0);
    expect(signer).not.toHaveBeenCalled();
  });
  it("refuses a foreign journal edit while the owning submission is in flight", async () => {
    const f = fixture();
    const signer = async () => {
      const changed: SourceExecutionJournal = f.store.readJournal();
      delete changed.pending;
      fs.writeFileSync(f.store.paths.journal, JSON.stringify(changed));
      return f.transactionHash;
    };
    await expect(f.store.executeBoundary({ ...f.boundary, operatorSubmitCreate: signer })).rejects.toThrow(
      "journal changed",
    );
    expect(fs.existsSync(f.store.paths.lock)).toBe(true);
  });
});
