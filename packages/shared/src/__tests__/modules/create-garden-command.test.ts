import { describe, expect, it, vi } from "vitest";
import {
  createGarden,
  estimateGardenCreation,
  type CreateGardenCommand,
  type CreateGardenPorts,
} from "../../modules/garden/create-garden-command";
import { WeightScheme } from "../../types/gardens-community";

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
    operators: [],
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
      send: vi.fn(async () => {
        events.push("send");
        return txHash;
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

    await expect(createGarden(command, ports)).resolves.toBe(txHash);

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
