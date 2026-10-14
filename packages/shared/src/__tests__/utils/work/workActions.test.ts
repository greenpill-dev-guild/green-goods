import { afterEach, describe, expect, it, vi } from "vitest";
import { shareWork, type WorkData } from "../../../utils/work/workActions";

const work: WorkData = {
  id: "work/123",
  gardenId: "0x123",
  title: "Planting",
  status: "approved",
  createdAt: 0,
  media: [],
};

afterEach(() => vi.unstubAllGlobals());

function setup(href: string, share?: ReturnType<typeof vi.fn>) {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("window", { location: { href }, isSecureContext: true });
  vi.stubGlobal("navigator", { share, clipboard: { writeText } });
  return writeText;
}

describe("work share links", () => {
  it("shares the record on the current host, without unrelated route or query state", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setup("https://beta.greengoods.app/home/another?shareTarget=private#details", share);
    await shareWork(work);
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://beta.greengoods.app/home/0x123/work/work%2F123",
      })
    );
  });
  it("copies the record link when native sharing is unavailable", async () => {
    const copy = setup("https://beta.greengoods.app/home");
    await shareWork(work);
    expect(copy).toHaveBeenCalledWith("https://beta.greengoods.app/home/0x123/work/work%2F123");
  });
  it("retains the gateway path in hash-router builds", async () => {
    const copy = setup("https://gateway.example/ipfs/cid/?private=1#/home/old?tab=work");
    await shareWork(work);
    expect(copy).toHaveBeenCalledWith(
      "https://gateway.example/ipfs/cid/#/home/0x123/work/work%2F123"
    );
  });
  it("does not overwrite the clipboard when sharing is cancelled", async () => {
    const copy = setup(
      "https://beta.greengoods.app/home",
      vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError"))
    );
    await shareWork(work);
    expect(copy).not.toHaveBeenCalled();
  });
  it("falls back after a native failure and reports a failed copy", async () => {
    const copy = setup(
      "https://beta.greengoods.app/home",
      vi.fn().mockRejectedValue(new Error("Unavailable"))
    );
    copy.mockRejectedValue(new Error("Denied"));
    await expect(shareWork(work)).rejects.toThrow("Could not copy");
  });
});
