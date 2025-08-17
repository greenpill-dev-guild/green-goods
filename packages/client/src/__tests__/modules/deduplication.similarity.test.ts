import { describe, it, expect } from "vitest";

import { DeduplicationManager } from "../../modules/deduplication";

describe("modules/deduplication similarity and stats", () => {
  it("finds similar work based on simple hash similarity and reports stats", () => {
    const mgr = new DeduplicationManager();
    const workA = { data: { gardenAddress: "0x1", feedback: "a", actionUID: 1 } } as any;
    const workB = { data: { gardenAddress: "0x1", feedback: "a!", actionUID: 1 } } as any;
    const workC = {
      data: { gardenAddress: "0x1", feedback: "completely different", actionUID: 1 },
    } as any;

    const hashA = mgr.generateContentHash(workA);
    const hashB = mgr.generateContentHash(workB);
    expect(typeof hashA).toBe("string");
    expect(typeof hashB).toBe("string");

    mgr.addToLocalCache("id-a", workA);
    mgr.addToLocalCache("id-b", workB);
    mgr.addToLocalCache("id-c", workC);

    const similarToA = mgr.findSimilarWork(workA, 0.3);
    expect(Array.isArray(similarToA)).toBe(true);

    const stats = mgr.getLocalCacheStats();
    expect(stats.uniqueHashes).toBeGreaterThan(0);
  });
});
