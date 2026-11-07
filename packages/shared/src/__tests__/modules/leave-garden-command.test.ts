import { describe, expect, it, vi } from "vitest";
import { arbitrum, sepolia } from "viem/chains";
import { createFakeSmartAccountClient } from "../test-utils/transaction-fakes";
import { PasskeySender } from "../../modules/transactions/passkey-sender";
import type { TxResult } from "../../modules/transactions/types";
import {
  createDefaultLeaveGardenPorts,
  leaveGarden,
  reconcileLeaveGarden,
  type LeaveGardenPorts,
} from "../../modules/garden/leave-garden-command";

const command = {
  gardenAddress: "0x1111111111111111111111111111111111111111" as const,
  userAddress: "0x2222222222222222222222222222222222222222" as const,
  chainId: 42161,
};
const moduleAddress = "0x3333333333333333333333333333333333333333" as const;
function ports(): LeaveGardenPorts {
  const pending = new Map<string, TxResult>();
  const scope = (c: { chainId: number; userAddress: string; gardenAddress: string }) =>
    `${c.chainId}:${c.userAddress}:${c.gardenAddress}`;
  return {
    pending: {
      load: (c) => pending.get(scope(c)),
      record: (c, result) => {
        pending.set(scope(c), result);
      },
      clear: (c) => {
        pending.delete(scope(c));
      },
    },
    reconcile: vi.fn().mockResolvedValue({ status: "unresolved" }),
    moduleAddress: vi.fn().mockResolvedValue(moduleAddress),
    simulate: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue({ hash: "0x123", sponsored: false }),
    receipt: vi.fn().mockResolvedValue({ status: "success", blockNumber: 40n }),
    confirmed: vi.fn(),
  };
}

describe("leaveGarden", () => {
  it("targets the garden's module and settles only after a successful receipt", async () => {
    const p = ports();
    let confirm!: (value: { status: string; blockNumber: bigint }) => void;
    vi.mocked(p.receipt).mockImplementation(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        })
    );
    const result = leaveGarden(command, p);
    await vi.waitFor(() => expect(p.receipt).toHaveBeenCalled());
    expect(p.confirmed).not.toHaveBeenCalled();
    confirm({ status: "success", blockNumber: 40n });
    await expect(result).resolves.toBe("0x123");
    expect(p.simulate).toHaveBeenCalledWith(command, moduleAddress);
    expect(p.send).toHaveBeenCalledWith(command, moduleAddress);
    expect(p.confirmed).toHaveBeenCalledWith(command, 40n);
  });
  it("does not send or clear membership when an Owner is refused", async () => {
    const p = ports();
    vi.mocked(p.simulate).mockRejectedValue(new Error("OwnerCannotLeave"));
    await expect(leaveGarden(command, p)).rejects.toThrow("OwnerCannotLeave");
    expect(p.send).not.toHaveBeenCalled();
    expect(p.confirmed).not.toHaveBeenCalled();
  });
  it("retains membership when the signer cancels", async () => {
    const p = ports();
    vi.mocked(p.send).mockRejectedValue(new Error("User rejected request"));
    await expect(leaveGarden(command, p)).rejects.toThrow("User rejected");
    expect(p.confirmed).not.toHaveBeenCalled();
  });
  it.each(["reverted", "unknown"])("does not settle a %s receipt", async (status) => {
    const p = ports();
    vi.mocked(p.receipt).mockResolvedValue({ status, blockNumber: 40n });
    await expect(leaveGarden(command, p)).rejects.toThrow();
    expect(p.confirmed).not.toHaveBeenCalled();
  });
  it("keeps an uncertain send unchanged when receipt lookup fails", async () => {
    const p = ports();
    vi.mocked(p.receipt).mockRejectedValue(new Error("timeout"));
    await expect(leaveGarden(command, p)).rejects.toThrow("transaction-confirmation-pending");
    expect(p.confirmed).not.toHaveBeenCalled();
  });
  it("refuses a garden without a configured Hats module", async () => {
    const p = ports();
    vi.mocked(p.moduleAddress).mockResolvedValue(undefined);
    await expect(leaveGarden(command, p)).rejects.toThrow();
    expect(p.send).not.toHaveBeenCalled();
  });
});

describe("departure submission recovery", () => {
  it("rechecks a timed-out receipt on retry without simulating or sending again", async () => {
    const p = ports();
    vi.mocked(p.receipt).mockRejectedValueOnce(new Error("timeout"));
    await expect(leaveGarden(command, p)).rejects.toThrow("transaction-confirmation-pending");
    expect(p.pending.load(command)?.hash).toBe("0x123");
    expect(p.confirmed).not.toHaveBeenCalled();
    await expect(leaveGarden(command, p)).resolves.toBe("0x123");
    expect(p.send).toHaveBeenCalledOnce();
    expect(p.simulate).toHaveBeenCalledOnce();
    expect(p.receipt).toHaveBeenCalledTimes(2);
    expect(p.confirmed).toHaveBeenCalledWith(command, 40n);
    expect(p.pending.load(command)).toBeUndefined();
  });
  it("keeps an unknown submitted operation blocked across retries", async () => {
    const p = ports();
    vi.mocked(p.send).mockResolvedValue({
      hash: "0x123",
      sponsored: true,
      confirmation: "pending",
    });
    await expect(leaveGarden(command, p)).rejects.toThrow("transaction-confirmation-pending");
    await expect(leaveGarden(command, p)).rejects.toThrow("transaction-confirmation-pending");
    expect(p.send).toHaveBeenCalledOnce();
    expect(p.confirmed).not.toHaveBeenCalled();
    expect(p.receipt).not.toHaveBeenCalled();
  });
  it("reconciles a later successful operation to its execution receipt", async () => {
    const p = ports();
    vi.mocked(p.send).mockResolvedValue({
      hash: "0x123",
      sponsored: true,
      confirmation: "pending",
    });
    await expect(leaveGarden(command, p)).rejects.toThrow();
    vi.mocked(p.reconcile).mockResolvedValue({ status: "confirmed", transactionHash: "0x456" });
    await expect(leaveGarden(command, p)).resolves.toBe("0x456");
    expect(p.receipt).toHaveBeenCalledWith("0x456", command.chainId);
    expect(p.send).toHaveBeenCalledOnce();
    expect(p.confirmed).toHaveBeenCalledOnce();
  });
  it.each([
    "receipt",
    "operation",
  ])("clears a proven reverted %s before an explicit new attempt", async (kind) => {
    const p = ports();
    if (kind === "receipt")
      vi.mocked(p.receipt).mockResolvedValueOnce({ status: "reverted", blockNumber: 40n });
    else {
      vi.mocked(p.send).mockResolvedValueOnce({
        hash: "0x123",
        sponsored: true,
        confirmation: "pending",
      });
      vi.mocked(p.reconcile).mockResolvedValue({ status: "reverted" });
    }
    await expect(leaveGarden(command, p)).rejects.toThrow("Transaction reverted");
    expect(p.pending.load(command)).toBeUndefined();
    expect(p.confirmed).not.toHaveBeenCalled();
    await expect(leaveGarden(command, p)).resolves.toBe("0x123");
    expect(p.send).toHaveBeenCalledTimes(2);
  });
});

describe("default departure sender ownership", () => {
  it.each([
    "module",
    "simulation",
  ])("refuses a session that changes during %s lookup", async (stage) => {
    const p = ports();
    let active = true;
    const sendContractCall = vi.fn();
    const defaults = createDefaultLeaveGardenPorts({
      transactionSender: {
        authMode: "wallet",
        supportsBatching: false,
        supportsSponsorship: false,
        sendContractCall,
      },
      assertOwnership: () => {
        if (!active) throw new Error("session-changed");
      },
      pending: p.pending,
      confirmed: p.confirmed,
    });
    p.send = defaults.send;
    if (stage === "module")
      vi.mocked(p.moduleAddress).mockImplementation(async () => {
        active = false;
        return moduleAddress;
      });
    else
      vi.mocked(p.simulate).mockImplementation(async () => {
        active = false;
      });
    await expect(leaveGarden(command, p)).rejects.toThrow("session-changed");
    expect(sendContractCall).not.toHaveBeenCalled();
  });
  it.each([
    "account",
    "chain",
  ])("refuses a passkey client with a different %s before any operation is sent", async (drift) => {
    const primary = createFakeSmartAccountClient({
      accountAddress: command.userAddress,
      chain: arbitrum,
    });
    const changed = createFakeSmartAccountClient({
      accountAddress: drift === "account" ? moduleAddress : command.userAddress,
      chain: drift === "chain" ? sepolia : arbitrum,
    });
    const sender = new PasskeySender(primary, {
      resolveSmartAccountClient: async () => changed,
      assertWriteSafety: async () => {},
    });
    const p = ports();
    p.send = createDefaultLeaveGardenPorts({
      transactionSender: sender,
      assertOwnership: () => {},
      pending: p.pending,
      confirmed: p.confirmed,
    }).send;
    await expect(leaveGarden(command, p)).rejects.toThrow(
      drift === "account" ? "address_mismatch" : "chain_mismatch"
    );
    expect(primary.sendUserOperation).not.toHaveBeenCalled();
    expect(changed.sendUserOperation).not.toHaveBeenCalled();
    expect(p.confirmed).not.toHaveBeenCalled();
  });
});

describe("read-only departure recovery", () => {
  it("reads the saved receipt with zero module lookups, simulations or sends", async () => {
    const p = ports();
    p.pending.record(command, { hash: "0x123", sponsored: false });
    await expect(reconcileLeaveGarden(command, p)).resolves.toBe("0x123");
    expect(p.moduleAddress).not.toHaveBeenCalled();
    expect(p.simulate).not.toHaveBeenCalled();
    expect(p.send).not.toHaveBeenCalled();
    expect(p.receipt).toHaveBeenCalledWith("0x123", command.chainId);
  });
  it.each([
    "garden",
    "account",
    "chain",
  ])("never sends when the saved submission belongs to another %s", async (scope) => {
    const p = ports();
    p.pending.record(command, { hash: "0x123", sponsored: false });
    const other = {
      ...command,
      ...(scope === "garden" ? { gardenAddress: moduleAddress } : {}),
      ...(scope === "account" ? { userAddress: moduleAddress } : {}),
      ...(scope === "chain" ? { chainId: 11155111 } : {}),
    };
    await expect(reconcileLeaveGarden(other, p)).rejects.toThrow("No pending garden departure");
    expect(p.send).not.toHaveBeenCalled();
    expect(p.moduleAddress).not.toHaveBeenCalled();
    expect(p.receipt).not.toHaveBeenCalled();
  });
});
