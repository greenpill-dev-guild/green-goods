import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  sendVoucherAward,
  recoverVoucherAward,
} from "../modules/commitment-pooling/voucher-award-send";
import { voucherAwardSafeEnvelope } from "../modules/commitment-pooling/voucher-award-safe";
import type {
  VoucherAwardCommand,
  VoucherAwardRecord,
  VoucherAwardResponse,
} from "../public-contracts/voucher-awards";
import type { TransactionSender } from "../modules/transactions/types";
import type { BatchOperations, BatchRecord } from "../modules/transactions/batch-types";

const rpc = vi.hoisted(() => ({
  chain: { id: 100 },
  getCode: vi.fn(),
  readContract: vi.fn(),
  simulateContract: vi.fn(),
}));
vi.mock("@wagmi/core", () => ({ getPublicClient: () => rpc }));
vi.mock("../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
const reserve = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const recipient = "0x3333333333333333333333333333333333333333";
const hash = `0x${"ab".repeat(32)}` as const;
function fixture() {
  const owner = privateKeyToAccount(generatePrivateKey());
  const award = {
    awardId: "past-21",
    reserve,
    token,
    recipient,
    amount: "3",
    reason: "Past contribution",
    reference: null,
  } as const;
  const record: VoucherAwardRecord = {
    version: 1,
    award,
    safe: voucherAwardSafeEnvelope(award, 7n, 1),
    state: "awaiting_authorization",
    failure: null,
    transactionHash: null,
    createdBy: owner.address as VoucherAwardRecord["createdBy"],
    createdAt: "2026-11-08T00:00:00Z",
    updatedAt: "2026-11-08T00:00:00Z",
    revision: 0,
  };
  const confirmed = { ...record, state: "confirmed" as const, transactionHash: hash };
  const client = {
    request: vi.fn(
      async (command: VoucherAwardCommand): Promise<VoucherAwardResponse> => ({
        ok: true,
        record: command.action === "reconcile" ? confirmed : record,
      })
    ),
  };
  const operation = {
    id: `voucher-award:${record.safe.safeTxHash}:${owner.address.toLowerCase()}:0`,
    updatedAt: 1,
    status: "confirmed",
    receipts: [{ transactionHash: hash, status: "success" }],
    groups: [],
  } as unknown as BatchRecord;
  const batches = {
    list: vi.fn(async () => [] as BatchRecord[]),
    reconcile: vi.fn<BatchOperations["reconcile"]>(async () => operation),
    release: vi.fn<BatchOperations["release"]>(),
    execute: vi.fn<BatchOperations["execute"]>(async (prepared, options) => {
      await options.preflight(prepared, [award.awardId]);
      await options.verify({
        account: owner.address,
        chainId: 100,
        itemIds: [award.awardId],
        receipts: operation.receipts,
      });
      return operation;
    }),
  };
  const sender: TransactionSender = {
    authMode: "wallet",
    supportsSponsorship: false,
    supportsBatching: false,
    batches,
    sendContractCall: vi.fn(),
    assertOwnership: vi.fn(),
    signTypedData: vi.fn(async ({ data }) => owner.signTypedData(data)),
  };
  const assertCurrent = vi.fn();
  return {
    record,
    operation,
    owner,
    client,
    batches,
    sender,
    assertCurrent,
    input: { record, actor: owner.address, sender, client, assertCurrent },
  };
}
beforeEach(() => {
  rpc.getCode.mockReset().mockResolvedValue("0x");
  rpc.simulateContract.mockReset().mockResolvedValue({});
  rpc.readContract
    .mockReset()
    .mockImplementation(async ({ functionName }) =>
      functionName === "nonce" ? 7n : functionName === "getThreshold" ? 1n : 100n
    );
});
describe("award send and recovery", () => {
  it("uses the existing sender journal and confirms only through the durable receipt verifier", async () => {
    const f = fixture();
    const result = await sendVoucherAward(f.input);
    expect(result.record.state).toBe("confirmed");
    expect(f.batches.execute).toHaveBeenCalledOnce();
    const prepared = f.batches.execute.mock.calls[0][0];
    expect(prepared.mode).toBe("single-call");
    expect(prepared.items[0].call.functionName).toBe("execTransaction");
    expect(prepared.items[0].call.args[9]).toMatch(/^0x[a-f\d]{128}(1b|1c)$/i);
    expect(rpc.simulateContract).toHaveBeenCalledOnce();
  });
  it("reconciles a pending journal entry without another signing or sending attempt", async () => {
    const f = fixture();
    f.batches.list.mockResolvedValue([{ ...f.operation, status: "unresolved" }]);
    expect((await sendVoucherAward(f.input)).record.state).toBe("confirmed");
    expect(f.batches.reconcile).toHaveBeenCalledOnce();
    expect(f.sender.signTypedData).not.toHaveBeenCalled();
    expect(f.batches.execute).not.toHaveBeenCalled();
  });
  it("refuses contract owners and changed nonces before signing", async () => {
    const f = fixture();
    rpc.getCode.mockResolvedValueOnce("0x1234");
    await expect(sendVoucherAward(f.input)).rejects.toThrow("Safe signing handoff");
    rpc.readContract.mockImplementation(async ({ functionName }) =>
      functionName === "nonce" ? 8n : functionName === "getThreshold" ? 1n : 100n
    );
    await expect(sendVoucherAward(f.input)).rejects.toThrow("nonce or reserve changed");
    expect(f.sender.signTypedData).not.toHaveBeenCalled();
    expect(f.batches.execute).not.toHaveBeenCalled();
  });
  it("keeps an unknown submission unresolved and never creates a recovery submission", async () => {
    const f = fixture();
    const unresolved = { ...f.operation, status: "unresolved" as const, receipts: [] };
    f.batches.list.mockResolvedValue([unresolved]);
    f.batches.reconcile.mockResolvedValue(unresolved);
    const result = await recoverVoucherAward(f.input);
    expect(result.operation?.status).toBe("unresolved");
    expect(result.record.state).toBe("awaiting_authorization");
    expect(f.batches.execute).not.toHaveBeenCalled();
    expect(f.sender.signTypedData).not.toHaveBeenCalled();
  });
});
