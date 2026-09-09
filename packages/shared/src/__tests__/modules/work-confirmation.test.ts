import { describe, expect, it, vi } from "vitest";
import { reconcileWorkTransaction, claimWorkJobs } from "../../modules/work/work-confirmation";
const hash = `0x${"12".repeat(32)}` as const;
describe("work confirmation", () => {
  it.each(["success", "reverted"])("classifies a %s receipt", async (status) => {
    expect(await reconcileWorkTransaction(hash, 11155111, async () => ({ status }))).toBe(
      status === "success" ? "confirmed" : "reverted"
    );
  });
  it("does not infer failure from missing receipts or network errors", async () => {
    expect(
      await reconcileWorkTransaction(hash, 11155111, async () => {
        throw new Error("not found");
      })
    ).toBe("unresolved");
  });
  it("preserves opaque wallet identifiers without a receipt query", async () => {
    const read = vi.fn();
    expect(await reconcileWorkTransaction("0xsafe", 11155111, read)).toBe("confirmed");
    expect(read).not.toHaveBeenCalled();
  });
  it("excludes a batch and an ordinary attempt on the same job", () => {
    const release = claimWorkJobs(["a", "b"]);
    expect(release).not.toBeNull();
    expect(claimWorkJobs(["b"])).toBeNull();
    release!();
    const next = claimWorkJobs(["b"]);
    expect(next).not.toBeNull();
    next!();
  });
});
