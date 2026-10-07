import { describe, expect, it, vi } from "vitest";
import {
  createDefaultCreateGardenPorts,
  createGarden,
  estimateGardenCreation,
  type CreateGardenCommand,
  type CreateGardenPorts,
} from "../../modules/garden/create-garden-command";
import { beforeEach } from "vitest";
import type { TransactionSender } from "../../modules/transactions/types";
import { WeightScheme } from "../../types/gardens-community";

const mocks = vi.hoisted(() => ({
  simulate: vi.fn(),
  readContract: vi.fn(),
  waitReceipt: vi.fn(),
  receipt: vi.fn(),
}));
vi.mock("../../utils/blockchain/simulation", () => ({ simulateTransaction: mocks.simulate }));
vi.mock("@wagmi/core", () => ({ waitForTransactionReceipt: mocks.waitReceipt }));
vi.mock("../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
vi.mock("../../utils/blockchain/contracts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/blockchain/contracts")>()),
  getNetworkContracts: () => ({ gardenToken, greenGoodsENS }),
  createClients: () => ({
    publicClient: { readContract: mocks.readContract, getTransactionReceipt: mocks.receipt },
  }),
}));

const gardenToken = "0x1111111111111111111111111111111111111111" as const;
const greenGoodsENS = "0x2222222222222222222222222222222222222222" as const;
const accountAddress = "0x3333333333333333333333333333333333333333" as const;
const txHash = "0xabc123" as `0x${string}`;

const command: CreateGardenCommand = {
  chainId: 11155111,
  accountAddress,
  params: {
    name: "Test Garden",
    slug: "test-garden",
    description: "A test garden",
    location: "Earth",
    bannerImage: "ipfs://banner",
    metadata: "ipfs://metadata",
    openJoining: true,
    weightScheme: WeightScheme.Linear,
    domainMask: 15,
    gardeners: [accountAddress],
    stewards: [],
  },
};

function createPorts(events: string[] = []): CreateGardenPorts {
  return {
    reader: {
      contracts: vi.fn(() => ({ gardenToken, greenGoodsENS }) as never),
      estimateCcipFee: vi.fn(async () => {
        events.push("fee");
        return 5n;
      }),
      simulate: vi.fn(async () => {
        events.push("simulate");
        return { success: true };
      }),
      waitForReceipt: vi.fn(async () => {
        events.push("receipt");
      }),
      estimateTransaction: vi.fn(async () => ({ gasEstimate: 10n, gasPrice: 3n })),
    },
    sender: {
      reconcile: vi.fn(async () => ({ status: "unresolved" as const })),
      send: vi.fn(async () => {
        events.push("send");
        return { hash: txHash, sponsored: false };
      }),
    },
    documents: {
      addPending: vi.fn(() => {
        events.push("pending");
      }),
    },
    clock: { now: () => 1_234 },
  };
}

describe("createGarden", () => {
  it("simulates, sends, records, and confirms through explicit ports", async () => {
    const events: string[] = [];
    const ports = createPorts(events);

    await expect(createGarden(command, ports)).resolves.toMatchObject({ hash: txHash });

    expect(events).toEqual(["fee", "simulate", "send", "pending", "receipt"]);
    expect(ports.reader.simulate).toHaveBeenCalledWith(
      expect.objectContaining({
        gardenToken,
        accountAddress,
        chainId: 11155111,
        config: command.params,
      })
    );
    expect(ports.sender.send).toHaveBeenCalledWith(
      expect.objectContaining({ gardenToken, ccipFee: 5n })
    );
    expect(ports.documents.addPending).toHaveBeenCalledWith(txHash, 1_234);
    expect(ports.reader.waitForReceipt).toHaveBeenCalledWith(txHash, 11155111);
  });

  it("stops before sending when simulation fails", async () => {
    const ports = createPorts();
    vi.mocked(ports.reader.simulate).mockResolvedValue({
      success: false,
      error: { message: "Garden config is invalid" },
    });

    await expect(createGarden(command, ports)).rejects.toThrow("Garden config is invalid");
    expect(ports.sender.send).not.toHaveBeenCalled();
    expect(ports.documents.addPending).not.toHaveBeenCalled();
    expect(ports.reader.waitForReceipt).not.toHaveBeenCalled();
  });
});

describe("estimateGardenCreation", () => {
  it("returns the complete transaction and CCIP fee estimate", async () => {
    const ports = createPorts();

    await expect(estimateGardenCreation(command, { reader: ports.reader })).resolves.toEqual({
      gasEstimate: 10n,
      gasPrice: 3n,
      txFee: 30n,
      ccipFee: 5n,
      totalEstimatedFee: 35n,
      formatted: {
        txFeeEth: "0.00000000000000003",
        ccipFeeEth: "0.000000000000000005",
        totalEth: "0.000000000000000035",
      },
    });
    expect(ports.reader.estimateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ gardenToken, ccipFee: 5n })
    );
  });
});

describe("garden writes through the shared account sender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.simulate.mockResolvedValue({ success: true });
    mocks.readContract.mockResolvedValue(5n);
    mocks.waitReceipt.mockResolvedValue({ status: "success" });
  });
  function adapter(authMode: "wallet" | "passkey") {
    const sender: TransactionSender = {
      authMode,
      supportsSponsorship: authMode === "passkey",
      supportsBatching: false,
      assertOwnership: vi.fn(),
      sendContractCall: vi
        .fn()
        .mockResolvedValue({ hash: txHash, sponsored: authMode === "passkey" }),
    };
    const addPending = vi.fn();
    return {
      sender,
      addPending,
      ports: createDefaultCreateGardenPorts({ transactionSender: sender, addPending }),
    };
  }
  it.each([
    "wallet",
    "passkey",
  ] as const)("simulates and sends the %s account with the same chain and CCIP value", async (authMode) => {
    const { sender, ports } = adapter(authMode);
    await expect(createGarden(command, ports)).resolves.toMatchObject({ hash: txHash });
    expect(mocks.simulate).toHaveBeenCalledWith(
      gardenToken,
      expect.any(Array),
      "mintGarden",
      [command.params],
      accountAddress,
      command.chainId,
      5n
    );
    expect(sender.sendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        account: accountAddress,
        chainId: command.chainId,
        address: gardenToken,
        functionName: "mintGarden",
        args: [command.params],
        value: 5n,
      }),
      expect.objectContaining({ assertOwnership: expect.any(Function) })
    );
    expect(mocks.waitReceipt).not.toHaveBeenCalled(); // The shared sender has already confirmed it.
  });
  it("rejects an intervening account change before signing", async () => {
    const { sender, ports } = adapter("passkey");
    vi.mocked(sender.assertOwnership!).mockRejectedValueOnce(
      new Error("submission-ownership-changed")
    );
    await expect(createGarden(command, ports)).rejects.toThrow("submission-ownership-changed");
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });
  it("preserves an opaque Safe submission without waiting for a receipt or resending", async () => {
    const { sender, ports, addPending } = adapter("wallet");
    vi.mocked(sender.sendContractCall).mockResolvedValueOnce({
      hash: "0xSafeProposalIdentifier",
      sponsored: false,
      confirmation: "pending",
    });
    await expect(createGarden(command, ports)).resolves.toMatchObject({
      hash: "0xSafeProposalIdentifier",
      confirmation: "pending",
    });

    expect(addPending).toHaveBeenCalledWith("0xSafeProposalIdentifier");
    expect(mocks.waitReceipt).not.toHaveBeenCalled();
    await expect(
      ports.sender.reconcile("0xSafeProposalIdentifier", command.chainId)
    ).resolves.toEqual({ status: "unresolved" });
    expect(mocks.receipt).not.toHaveBeenCalled();
    expect(sender.sendContractCall).toHaveBeenCalledTimes(1);
  });
});

describe("garden confirmation reconciliation", () => {
  it.each(["success", "reverted"])("reads an existing canonical receipt: %s", async (status) => {
    const sender = { sendContractCall: vi.fn() } as unknown as TransactionSender;
    const ports = createDefaultCreateGardenPorts({
      transactionSender: sender,
      addPending: vi.fn(),
    });
    const hash = `0x${"ab".repeat(32)}` as const;
    mocks.receipt.mockResolvedValueOnce({ status, transactionHash: hash });
    await expect(ports.sender.reconcile(hash, command.chainId)).resolves.toEqual(
      status === "success" ? { status: "confirmed", transactionHash: hash } : { status: "reverted" }
    );
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });
  it("keeps unavailable execution evidence pending", async () => {
    mocks.receipt.mockRejectedValueOnce(new Error("RPC unavailable"));
    const ports = createDefaultCreateGardenPorts({
      transactionSender: { sendContractCall: vi.fn() } as unknown as TransactionSender,
      addPending: vi.fn(),
    });
    await expect(ports.sender.reconcile(`0x${"ab".repeat(32)}`, command.chainId)).resolves.toEqual({
      status: "unresolved",
    });
  });
});

it("uses wallet execution evidence to resolve an opaque proposal without sending", async () => {
  const sender = {
    sendContractCall: vi.fn(),
    reconcileBroadcast: vi
      .fn()
      .mockResolvedValue({ status: "confirmed", transactionHash: `0x${"ab".repeat(32)}` }),
  } as unknown as TransactionSender;
  const ports = createDefaultCreateGardenPorts({ transactionSender: sender, addPending: vi.fn() });
  await expect(
    ports.sender.reconcile("0xSafeProposalIdentifier", command.chainId)
  ).resolves.toMatchObject({ status: "confirmed" });
  expect(sender.reconcileBroadcast).toHaveBeenCalledWith({
    kind: "transaction",
    hash: "0xSafeProposalIdentifier",
  });
  expect(sender.sendContractCall).not.toHaveBeenCalled();
});
