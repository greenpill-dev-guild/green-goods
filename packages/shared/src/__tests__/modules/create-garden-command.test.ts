import { describe, expect, it, vi } from "vitest";
import {
  createDefaultCreateGardenPorts,
  createGarden,
  estimateGardenCreation,
  type CreateGardenCommand,
  type CreateGardenPorts,
} from "../../modules/garden/create-garden-command";
import { beforeEach } from "vitest";
import { withGasHeadroom } from "../../modules/transactions/gas-headroom";
import type { TransactionSender, TxResult } from "../../modules/transactions/types";
import { WalletCannotFundTransactionError } from "../../modules/transactions/wallet-funding";
import { WeightScheme } from "../../types/gardens-community";

const mocks = vi.hoisted(() => ({
  simulate: vi.fn(),
  readContract: vi.fn(),
  waitReceipt: vi.fn(),
  receipt: vi.fn(),
  estimateGas: vi.fn(async () => 1n),
}));
vi.mock("../../utils/blockchain/simulation", () => ({ simulateTransaction: mocks.simulate }));
vi.mock("../../modules/transactions/receipt-wait", () => ({ waitForReceipt: mocks.waitReceipt }));
vi.mock("../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
vi.mock("../../utils/blockchain/contracts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/blockchain/contracts")>()),
  getNetworkContracts: () => ({ gardenToken, greenGoodsENS }),
  createClients: () => ({
    publicClient: {
      readContract: mocks.readContract,
      getTransactionReceipt: mocks.receipt,
      getBalance: async () => 10n ** 18n,
      estimateGas: mocks.estimateGas,
      estimateFeesPerGas: async () => ({ maxFeePerGas: 1n }),
    },
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
      gardenNameReserve: vi.fn(async () => 0n),
      balanceOf: vi.fn(async () => 100n),
      simulate: vi.fn(async () => {
        events.push("simulate");
        return { success: true };
      }),
      waitForReceipt: vi.fn(async () => {
        events.push("receipt");
      }),
      estimateTransaction: vi.fn(async () => ({ gasEstimate: 1000n, gasPrice: 3n })),
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

  it("sends nothing for the name when the reserve covers it, whatever the creator's balance", async () => {
    const ports = createPorts();
    vi.mocked(ports.reader.gardenNameReserve).mockResolvedValue(5n);
    vi.mocked(ports.reader.balanceOf).mockRejectedValue(new Error("balance unavailable"));

    await createGarden(command, ports);

    expect(ports.sender.send).toHaveBeenCalledWith(expect.objectContaining({ ccipFee: 0n }));
    expect(ports.reader.balanceOf).not.toHaveBeenCalled();
  });

  it("still creates the garden when neither the reserve nor the creator can pay for the name", async () => {
    const ports = createPorts();
    vi.mocked(ports.reader.gardenNameReserve).mockResolvedValue(4n);
    vi.mocked(ports.reader.balanceOf).mockResolvedValue(4n);

    await createGarden(command, ports);

    expect(ports.sender.send).toHaveBeenCalledWith(expect.objectContaining({ ccipFee: 0n }));
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
  it("prices the network fee at the gas the mint is sent with, plus the CCIP fee", async () => {
    const ports = createPorts();

    // 1,000 gas estimated goes out at 1,050 with the mint's headroom, at 3 wei a gas.
    await expect(estimateGardenCreation(command, { reader: ports.reader })).resolves.toEqual({
      gasEstimate: 1000n,
      gasPrice: 3n,
      txFee: 3150n,
      ccipFee: 5n,
      nameFunding: "creator",
      totalEstimatedFee: 3155n,
      formatted: {
        txFeeEth: "0.00000000000000315",
        ccipFeeEth: "0.000000000000000005",
        totalEth: "0.000000000000003155",
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
    mocks.readContract.mockImplementation(async ({ functionName }: { functionName: string }) =>
      functionName === "gardenNameReserve" ? 0n : 5n
    );
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
  it("sends the mint with enough gas over the estimate for its last cross-chain step", async () => {
    const { sender, ports } = adapter("wallet");
    await createGarden(command, ports);
    const [mint] = vi.mocked(sender.sendContractCall).mock.calls[0];

    // On forks of Arbitrum an unnamed garden's mint succeeds at its 24,835,549 estimate, but its
    // last step needs 25,271,190. A named garden's 25,536,980 mint must stay under the 32M cap.
    expect(withGasHeadroom(24_835_549n, [mint])).toBeGreaterThanOrEqual(25_271_190n);
    expect(withGasHeadroom(25_536_980n, [mint])).toBeLessThanOrEqual(32_000_000n);
  });
  it("checks that a wallet can pay for the gas the mint is sent with", async () => {
    const { sender, ports } = adapter("wallet");
    // At 1 wei a gas, the 1 ETH balance covers this estimate but not the mint's headroom over it.
    mocks.estimateGas.mockResolvedValueOnce(970_000_000_000_000_000n);

    await expect(createGarden(command, ports)).rejects.toBeInstanceOf(
      WalletCannotFundTransactionError
    );
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });
  it("checkpoints a garden UserOperation before receipt failure and recovers without minting twice", async () => {
    const { sender } = adapter("passkey");
    const operation = `0x${"cd".repeat(32)}` as const;
    let saved: TxResult | undefined;
    vi.mocked(sender.sendContractCall).mockImplementationOnce(async (_call, options) => {
      await options?.onBroadcastReference?.({
        kind: "user-operation",
        hash: operation,
        chainId: command.chainId,
      });
      expect(saved?.broadcastReference?.hash).toBe(operation);
      throw new Error("Receipt RPC timeout");
    });
    const ports = createDefaultCreateGardenPorts({
      transactionSender: sender,
      addPending: vi.fn(),
      checkpoint: (result) => {
        saved = result;
      },
    });
    expect(await createGarden(command, ports)).toMatchObject({
      hash: operation,
      confirmation: "pending",
    });
    const restored = JSON.parse(JSON.stringify(saved)) as TxResult;
    sender.reconcileBroadcast = vi
      .fn()
      .mockResolvedValue({ status: "confirmed", transactionHash: txHash });
    expect(
      await ports.sender.reconcile(restored.hash, command.chainId, restored.broadcastReference)
    ).toEqual({ status: "confirmed", transactionHash: txHash });
    expect(sender.reconcileBroadcast).toHaveBeenCalledWith({
      kind: "user-operation",
      hash: operation,
      chainId: command.chainId,
    });
    expect(sender.sendContractCall).toHaveBeenCalledOnce();
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
    chainId: command.chainId,
  });
  expect(sender.sendContractCall).not.toHaveBeenCalled();
});
