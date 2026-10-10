import { describe, expect, it, vi } from "vitest";
import {
  joinGarden,
  type JoinGardenCommand,
  type JoinGardenPorts,
} from "../../modules/garden/join-garden-command";

const command: JoinGardenCommand = {
  gardenAddress: "0x1111111111111111111111111111111111111111",
  userAddress: "0x2222222222222222222222222222222222222222",
  chainId: 11155111,
  smartAccountClient: null,
};

function ports(): JoinGardenPorts {
  return {
    reader: { simulate: vi.fn().mockResolvedValue({ success: true }) },
    sender: {
      smartAccount: vi.fn().mockResolvedValue("0xsmart"),
      wallet: vi.fn().mockResolvedValue("0xwallet"),
    },
    documents: { recordPending: vi.fn() },
    clock: { now: () => 1234 },
  };
}

describe("joinGarden", () => {
  it("simulates, sends, and records a wallet join through ports", async () => {
    const dependencies = ports();

    await expect(joinGarden(command, dependencies)).resolves.toBe("0xwallet");
    expect(dependencies.reader.simulate).toHaveBeenCalledWith(command);
    expect(dependencies.sender.wallet).toHaveBeenCalledWith(command);
    expect(dependencies.documents.recordPending).toHaveBeenCalledWith(
      command.gardenAddress,
      command.userAddress,
      1234
    );
  });

  it("does not send or record when wallet simulation fails", async () => {
    const dependencies = ports();
    vi.mocked(dependencies.reader.simulate).mockResolvedValue({
      success: false,
      error: { name: "AlreadyGardener", message: "Already joined" },
    });

    await expect(joinGarden(command, dependencies)).rejects.toMatchObject({
      name: "AlreadyGardener",
      message: "Already joined",
    });
    expect(dependencies.sender.wallet).not.toHaveBeenCalled();
    expect(dependencies.documents.recordPending).not.toHaveBeenCalled();
  });
});
