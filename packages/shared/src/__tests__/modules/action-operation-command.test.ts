import { describe, expect, it, vi } from "vitest";
import {
  executeActionOperation,
  type ActionOperationCall,
} from "../../modules/action/action-operation-command";

const call: ActionOperationCall = {
  contractAddress: "0x1111111111111111111111111111111111111111",
  abi: [],
  account: "0x2222222222222222222222222222222222222222",
  chainId: 11155111,
  functionName: "updateActionTitle",
  args: [1n, "New title"],
  messages: { loading: "Loading", success: "Done", error: "Failed" },
};

describe("executeActionOperation", () => {
  it("stops before sending when simulation fails", async () => {
    const send = vi.fn();
    const error = { name: "Unauthorized", message: "Not allowed" };

    await expect(
      executeActionOperation(call, {
        reader: { simulate: vi.fn().mockResolvedValue({ success: false, error }) },
        sender: { send },
      })
    ).resolves.toEqual({ success: false, error });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the exact simulated call", async () => {
    const send = vi.fn().mockResolvedValue("0xabc");

    await expect(
      executeActionOperation(call, {
        reader: { simulate: vi.fn().mockResolvedValue({ success: true }) },
        sender: { send },
      })
    ).resolves.toEqual({ success: true, hash: "0xabc" });
    expect(send).toHaveBeenCalledWith(call);
  });
});
