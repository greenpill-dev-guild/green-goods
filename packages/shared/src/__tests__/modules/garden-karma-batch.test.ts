import "fake-indexeddb/auto";
import { encodeAbiParameters, encodeEventTopics, type Hex, type Log, toHex } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  karmaReconcileCalls,
  moveOnFromKarmaReconcileHold,
  readKarmaReconcileHold,
  reconcileKarmaBatch,
} from "../../modules/garden/karma-batch";
import {
  KARMA_MODULE_ABI,
  type KarmaReconcileChain,
} from "../../modules/garden/karma-sync-records";
import type { BatchExecution } from "../../modules/transactions/batch-types";
import type { Address } from "../../types/domain";
import { createFakeBatchingSender } from "../test-utils/transaction-fakes";

const chainId = 42161;
const hash = `0x${"ab".repeat(32)}` as const;
const CONFIRMED: Partial<BatchExecution> = {
  status: "confirmed",
  receipts: [{ transactionHash: hash, status: "success" }],
};
const NONE = "0x0000000000000000000000000000000000000000" as Address;
const UID = `0x${"11".repeat(32)}` as Hex;
/** `IKarmaGAPModule.KarmaSyncOperation` and `KarmaSyncOutcome`. */
const PROJECT = 0;
const DETAILS = 1;
const MEMBERSHIP = 2;
const ACCESS = 3;
const NOOP = 0;
const SUCCEEDED = 1;
const FAILED = 2;

/** Every test gets its own addresses: the journal outlives each one. */
function address(): Address {
  return toHex(crypto.getRandomValues(new Uint8Array(20)));
}

function setup(accountCount: number, execution: Partial<BatchExecution> = CONFIRMED) {
  const steward = address();
  const garden = address();
  const module = address();
  const accounts = Array.from({ length: accountCount }, address);
  const sender = createFakeBatchingSender(steward, execution);
  const logs: Partial<Log>[] = [];
  const chain = { logsOf: vi.fn(async () => logs as Log[]) } satisfies KarmaReconcileChain;
  const input = {
    batches: sender.batches!,
    scope: { account: steward, chainId },
    garden,
    chain,
    retryMs: 0,
  };
  const calls = karmaReconcileCalls({ module, garden, chainId, accounts });
  const record = (account: Address, operation: number, outcome: number, reason = "") =>
    logs.push({
      address: module,
      topics: encodeEventTopics({
        abi: KARMA_MODULE_ABI,
        eventName: "KarmaSyncRecorded",
        args: { garden, projectUID: UID, account },
      }) as Log["topics"],
      data: encodeAbiParameters(
        [
          { type: "uint8" },
          { type: "uint8" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "string" },
        ],
        [operation, outcome, UID, UID, reason]
      ),
    });
  const syncProject = (outcome = NOOP) => {
    record(NONE, PROJECT, outcome);
    record(NONE, DETAILS, outcome);
  };
  const syncAccount = (account: Address, outcome = SUCCEEDED, reason = "") => {
    record(account, ACCESS, outcome, reason);
    record(account, MEMBERSHIP, outcome, reason);
  };
  const reconcile = () => reconcileKarmaBatch({ ...input, rail: "passkey", calls });
  return { input, sender, accounts, calls, record, syncProject, syncAccount, reconcile, module };
}

describe("reconcileKarmaBatch", () => {
  it("signs the project and the first nine accounts together, then the rest", async () => {
    const { sender, accounts, calls, syncProject, syncAccount, reconcile } = setup(12);
    syncProject();
    for (const account of accounts) syncAccount(account);

    const outcome = await reconcile();

    const sent = vi.mocked(sender.submitAtomicBatch!).mock.calls.map(([group]) => group);
    expect(sent.map((group) => group.length)).toEqual([10, 3]);
    expect(sent[0][0]).toMatchObject({ functionName: "reconcileProject" });
    expect(sent[1].map((call) => call.args[1])).toEqual(accounts.slice(9));
    // Each step attests inside try/catch, so a bare estimate could starve it.
    expect(calls.every(({ call }) => call.gasHeadroomPercent === 50)).toBe(true);
    expect(outcome).toEqual({
      recorded: [null, ...accounts].map((account) => ({ account, synced: true, reason: null })),
      unknown: 0,
      notSent: 0,
    });
  });

  it("reports a sync the chain recorded as failed, though its transaction landed", async () => {
    const { input, accounts, syncProject, syncAccount, reconcile } = setup(2);
    syncProject();
    syncAccount(accounts[0]);
    syncAccount(accounts[1], FAILED, "attestation_failed");

    const outcome = await reconcile();

    expect(outcome.recorded.map(({ synced, reason }) => ({ synced, reason }))).toEqual([
      { synced: true, reason: null },
      { synced: true, reason: null },
      { synced: false, reason: "attestation_failed" },
    ]);
    // Its outcome is known, so nothing holds the next sync.
    expect((await readKarmaReconcileHold(input)).hold).toBeNull();
  });

  it("holds a sync whose records are not all in its receipt", async () => {
    const { input, accounts, syncProject, record, reconcile } = setup(1);
    syncProject();
    record(accounts[0], ACCESS, SUCCEEDED);

    const outcome = await reconcile();

    expect(outcome).toMatchObject({ unknown: 2, notSent: 0 });
    const { hold } = await readKarmaReconcileHold(input);
    expect(hold?.calls).toBe(2);
    await expect(reconcile()).resolves.toMatchObject({ stoppedBy: "error", notSent: 2 });
  });

  it("stops before the next signature when the project could not be made", async () => {
    const { sender, accounts, record, syncAccount, reconcile } = setup(12);
    record(NONE, PROJECT, FAILED, "attestation_failed");
    for (const account of accounts.slice(0, 9)) syncAccount(account, FAILED, "project_not_found");

    const outcome = await reconcile();

    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
    expect(outcome).toMatchObject({ stoppedBy: "no-project", notSent: 3, unknown: 0 });
    expect(outcome.recorded.filter((call) => !call.synced)).toHaveLength(10);
  });

  it("sends nothing past its ceilings, so the next press can sign one call at a time", async () => {
    const { sender, reconcile } = setup(2);
    sender.preflightBatch = async () => ({
      gas: "13000000",
      maxFeePerGas: "30000000",
      maxFee: "390000000000000",
      sponsored: true,
      authority: "user-operation",
    });

    await expect(reconcile()).resolves.toMatchObject({ stoppedBy: "over-ceilings", notSent: 3 });
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
  });

  it("ends a hold only when the steward moves on, and reports a sync that turned out to land", async () => {
    const unknown = setup(1, { status: "unresolved", receipts: [] });
    await unknown.reconcile();
    const { hold } = await readKarmaReconcileHold(unknown.input);
    expect(hold).not.toBeNull();

    const settled = await moveOnFromKarmaReconcileHold(unknown.input, hold!);
    expect(settled).toEqual({ hold: null, saved: [{ recorded: [] }] });

    const landed = setup(1, { status: "unresolved", receipts: [] });
    await landed.reconcile();
    const shown = (await readKarmaReconcileHold(landed.input)).hold;
    vi.mocked(landed.sender.reconcileBatch!).mockResolvedValue(CONFIRMED as BatchExecution);
    landed.syncProject();
    landed.syncAccount(landed.accounts[0], FAILED, "admin_sync_failed");

    await expect(readKarmaReconcileHold(landed.input, shown)).resolves.toEqual({
      hold: null,
      saved: [
        {
          recorded: [
            { account: null, synced: true, reason: null },
            {
              account: landed.accounts[0].toLowerCase(),
              synced: false,
              reason: "admin_sync_failed",
            },
          ],
        },
      ],
    });
  });
});
