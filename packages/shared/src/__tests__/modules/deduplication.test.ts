import { describe, expect, it } from "vitest";

// TODO: DeduplicationManager class doesn't exist - these tests are outdated
// import {
//   DeduplicationManager,
//   defaultDeduplicationManager,
// } from "../../utils/work/deduplication";

describe.skip("modules/deduplication", () => {
  it("generates stable content hashes", () => {
    const mgr = new DeduplicationManager();
    const work = {
      data: { gardenAddress: "0xabc", feedback: "hello", actionUID: 1, chainId: 84532 },
      type: "work",
    } as any;

    const h1 = mgr.generateContentHash(work);
    const h2 = mgr.generateContentHash(work);
    expect(h1).toBeTypeOf("string");
    expect(h1).toBe(h2);
  });

  it("detects local duplicates after caching", () => {
    const mgr = new DeduplicationManager();
    const work = {
      data: { gardenAddress: "0xabc", feedback: "world", actionUID: 2, chainId: 84532 },
      type: "work",
    } as any;

    const before = mgr.checkLocalDuplicate(work);
    expect(before.isDuplicate).toBe(false);

    mgr.addToLocalCache("work-1", work);
    const after = mgr.checkLocalDuplicate(work);
    expect(after.isDuplicate).toBe(true);
    expect(after.existingItems).toContain("work-1");
  });

  it("comprehensive check is a no-op and allows submission", async () => {
    const res = await defaultDeduplicationManager.performComprehensiveCheck({ any: "data" });
    expect(res.isDuplicate).toBe(false);
    expect(res.conflictType).toBe("none");
  });

  it("optionally includes images in hash when enabled", () => {
    const mgr = new DeduplicationManager({ includeImages: true });
    const file = new File(["binary"], "photo.jpg", { type: "image/jpeg" });
    const base = { data: { gardenAddress: "0xabc", feedback: "img", actionUID: 3 } } as any;
    const hNoImg = new DeduplicationManager({ includeImages: false }).generateContentHash(base);
    const hWithImg = mgr.generateContentHash({ ...base, images: [file] });
    expect(hWithImg).not.toBe(hNoImg);
  });
});
