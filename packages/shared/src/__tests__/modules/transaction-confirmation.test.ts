import { describe, expect, it, vi } from "vitest";
import { reconcileTransaction } from "../../modules/transactions/confirmation";
import type { TransactionSender } from "../../modules/transactions/types";

const hash = `0x${"ab".repeat(32)}` as const;
const sender = { sendContractCall: vi.fn() } as unknown as TransactionSender;
describe("transaction confirmation", () => {
  it("never passes an opaque proposal to a receipt reader", async () => {
    const read = vi.fn();
    expect(
      await reconcileTransaction(sender, { hash: "0xProposal", sponsored: false }, read)
    ).toEqual({ status: "unresolved" });
    expect(read).not.toHaveBeenCalled();
  });
  it.each(["success", "reverted"] as const)("recognizes a canonical %s receipt", async (status) => {
    const read = vi.fn().mockResolvedValue({ status, transactionHash: hash });
    const outcome = await reconcileTransaction(sender, { hash, sponsored: false }, read);
    expect(outcome.status).toBe(status === "success" ? "confirmed" : "reverted");
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });
  it("keeps unavailable evidence unresolved", async () => {
    const read = vi.fn().mockRejectedValue(new Error("RPC unavailable"));
    expect(await reconcileTransaction(sender, { hash, sponsored: false }, read)).toEqual({
      status: "unresolved",
    });
  });
  it("uses a wallet resolver for an opaque proposal without another send", async () => {
    const resolve = vi.fn().mockResolvedValue({ status: "confirmed", transactionHash: hash });
    const read = vi.fn();
    expect(
      await reconcileTransaction(
        { ...sender, reconcileBroadcast: resolve },
        { hash: "0xProposal", sponsored: false },
        read
      )
    ).toEqual({ status: "confirmed", transactionHash: hash });
    expect(read).not.toHaveBeenCalled();
  });
});
