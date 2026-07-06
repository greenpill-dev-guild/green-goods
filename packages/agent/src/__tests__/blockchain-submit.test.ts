/**
 * Blockchain service submit tests.
 *
 * Pins the two on-chain conventions the approve flow depends on:
 * - submitWork waits for the attest receipt and returns the REAL work attestation UID
 *   from the EAS Attested event (fail loud on revert / missing event — a local id
 *   would orphan the approval for every EAS consumer).
 * - submitApproval attests with recipient = the GARDEN (matching work attestations and
 *   PWA approval paths), never the gardener.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const WORK_TX = `0x${"c".repeat(64)}` as const;
const APPROVAL_TX = `0x${"d".repeat(64)}` as const;
const WORK_UID = `0x${"e".repeat(64)}` as const;
const UNRELATED_UID = `0x${"f".repeat(64)}` as const;
const WORK_SCHEMA_UID = `0x${"5".repeat(64)}` as const;
const APPROVAL_SCHEMA_UID = `0x${"6".repeat(64)}` as const;
const EAS_ADDRESS = "0x4200000000000000000000000000000000000021" as const;
const GARDEN = "0x1111111111111111111111111111111111111111" as const;
const GARDENER = "0x2222222222222222222222222222222222222222" as const;
const PRIVATE_KEY = `0x${"11".repeat(32)}` as const;

const mockWaitForTransactionReceipt = vi.fn();
const mockContractRead = {
  isOperator: vi.fn(),
  isGardener: vi.fn(),
  name: vi.fn(),
};
const mockBlockchainLog = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    })),
    createWalletClient: vi.fn(() => ({ account: {}, chain: undefined })),
    getContract: vi.fn(() => ({ read: mockContractRead })),
  };
});

vi.mock("@green-goods/shared/config/blockchain", () => ({
  getEASConfig: vi.fn(() => ({
    WORK: { uid: WORK_SCHEMA_UID, schema: "" },
    WORK_APPROVAL: { uid: APPROVAL_SCHEMA_UID, schema: "" },
    ASSESSMENT: { uid: `0x${"7".repeat(64)}`, schema: "" },
    EAS: { address: EAS_ADDRESS },
    SCHEMA_REGISTRY: { address: "0x0000000000000000000000000000000000000000" },
  })),
}));

vi.mock("../services/logger", () => ({
  loggers: {
    blockchain: {
      error: mockBlockchainLog.error,
      warn: mockBlockchainLog.warn,
    },
  },
}));

const submitWorkBot = vi.fn(async () => WORK_TX);
const submitApprovalBot = vi.fn(async () => APPROVAL_TX);
vi.mock("@green-goods/shared/modules/work/bot-submission", () => ({
  submitWorkBot: (...args: unknown[]) => submitWorkBot(...(args as [])),
  submitApprovalBot: (...args: unknown[]) => submitApprovalBot(...(args as [])),
}));

import { encodeEventTopics, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";
import { initBlockchain, resetBlockchain } from "../services/blockchain";

const ATTESTED_EVENT = parseAbiItem(
  "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)"
);

/** A receipt log that real viem parseEventLogs decodes as an EAS Attested event. */
function attestedLog(
  uid: `0x${string}`,
  options: {
    address?: `0x${string}`;
    recipient?: `0x${string}`;
    schemaUID?: `0x${string}`;
  } = {}
) {
  const recipient = options.recipient ?? GARDEN;
  const schemaUID = options.schemaUID ?? WORK_SCHEMA_UID;
  return {
    address: options.address ?? EAS_ADDRESS,
    topics: encodeEventTopics({
      abi: [ATTESTED_EVENT],
      eventName: "Attested",
      args: { recipient, attester: GARDENER, schemaUID },
    }),
    data: uid, // single non-indexed bytes32 encodes as itself
  };
}

function workParams() {
  return {
    privateKey: PRIVATE_KEY,
    gardenAddress: GARDEN,
    actionUID: 1,
    actionTitle: "Work Submission",
    workData: { title: "t", plantSelection: [], plantCount: 0, feedback: "" },
  };
}

describe("blockchain.submitWork", () => {
  beforeEach(() => {
    resetBlockchain();
    mockWaitForTransactionReceipt.mockReset();
    mockContractRead.isOperator.mockReset();
    mockContractRead.isGardener.mockReset();
    mockContractRead.name.mockReset();
    mockBlockchainLog.error.mockReset();
    mockBlockchainLog.warn.mockReset();
    submitWorkBot.mockClear();
    submitApprovalBot.mockClear();
  });

  it("waits for the receipt and returns the on-chain work UID from the Attested event", async () => {
    mockWaitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [attestedLog(WORK_UID)],
    });
    const blockchain = initBlockchain(sepolia);

    const result = await blockchain.submitWork(workParams());

    expect(result).toEqual({ txHash: WORK_TX, workUID: WORK_UID });
    expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ hash: WORK_TX })
    );
  });

  it("selects the matching work attestation event, not the first Attested log", async () => {
    mockWaitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [
        attestedLog(UNRELATED_UID, { schemaUID: APPROVAL_SCHEMA_UID }),
        attestedLog(UNRELATED_UID, { recipient: GARDENER }),
        attestedLog(WORK_UID),
      ],
    });
    const blockchain = initBlockchain(sepolia);

    await expect(blockchain.submitWork(workParams())).resolves.toEqual({
      txHash: WORK_TX,
      workUID: WORK_UID,
    });
  });

  it("fails loud when the work attestation reverted", async () => {
    mockWaitForTransactionReceipt.mockResolvedValue({ status: "reverted", logs: [] });
    const blockchain = initBlockchain(sepolia);

    await expect(blockchain.submitWork(workParams())).rejects.toThrow(/reverted/);
  });

  it("fails loud when the receipt has no matching Work Attested event", async () => {
    mockWaitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [attestedLog(UNRELATED_UID, { schemaUID: APPROVAL_SCHEMA_UID })],
    });
    const blockchain = initBlockchain(sepolia);

    await expect(blockchain.submitWork(workParams())).rejects.toThrow(/no matching Work/);
  });

  it("fails loud when the receipt has no Attested event (never falls back to a local id)", async () => {
    mockWaitForTransactionReceipt.mockResolvedValue({ status: "success", logs: [] });
    const blockchain = initBlockchain(sepolia);

    await expect(blockchain.submitWork(workParams())).rejects.toThrow(/no matching Work/);
  });
});

describe("blockchain role verification", () => {
  beforeEach(() => {
    resetBlockchain();
    mockContractRead.isOperator.mockReset();
    mockContractRead.isGardener.mockReset();
    mockBlockchainLog.error.mockReset();
    mockBlockchainLog.warn.mockReset();
  });

  it("does not return raw operator verification error details to callers", async () => {
    mockContractRead.isOperator.mockRejectedValueOnce(
      new Error("RPC upstream leaked token secret-operator")
    );
    const blockchain = initBlockchain(sepolia);

    const result = await blockchain.isOperator(GARDEN, GARDENER);

    expect(result.verified).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("secret-operator");
    expect(JSON.stringify(mockBlockchainLog.error.mock.calls)).not.toContain("secret-operator");
  });

  it("does not return raw gardener verification error details to callers", async () => {
    mockContractRead.isGardener.mockRejectedValueOnce(
      new Error("RPC upstream leaked token secret-gardener")
    );
    const blockchain = initBlockchain(sepolia);

    const result = await blockchain.isGardener(GARDEN, GARDENER);

    expect(result.verified).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("secret-gardener");
    expect(JSON.stringify(mockBlockchainLog.error.mock.calls)).not.toContain("secret-gardener");
  });
});

describe("blockchain.submitApproval", () => {
  beforeEach(() => {
    resetBlockchain();
    submitApprovalBot.mockClear();
  });

  it("attests with the garden as EAS recipient and the on-chain work UID", async () => {
    const blockchain = initBlockchain(sepolia);

    const tx = await blockchain.submitApproval({
      privateKey: PRIVATE_KEY,
      gardenAddress: GARDEN,
      actionUID: 1,
      workUID: WORK_UID,
      approved: true,
      feedback: "ok",
    });

    expect(tx).toBe(APPROVAL_TX);
    const [, draft, recipient] = submitApprovalBot.mock.calls[0] as unknown as [
      unknown,
      { workUID: string },
      string,
    ];
    expect(recipient).toBe(GARDEN);
    expect(draft.workUID).toBe(WORK_UID);
  });
});
