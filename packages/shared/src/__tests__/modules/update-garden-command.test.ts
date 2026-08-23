import { describe, expect, it, vi } from "vitest";
import { updateGarden } from "../../modules/garden/update-garden-command";

describe("updateGarden", () => {
  it("builds one GardenAccount call through the sender port", async () => {
    const sender = vi.fn().mockResolvedValue("0xabc");
    const command = {
      gardenAddress: "0x1111111111111111111111111111111111111111" as const,
      abi: [],
      functionName: "setOpenJoining",
      value: true,
    };

    await expect(updateGarden(command, { sender })).resolves.toBe("0xabc");
    expect(sender).toHaveBeenCalledWith({
      address: command.gardenAddress,
      abi: [],
      functionName: "setOpenJoining",
      args: [true],
    });
  });
});
