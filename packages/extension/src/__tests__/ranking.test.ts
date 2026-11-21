import { describe, expect, it } from "vitest";
import { correctSectionIndexes, ENCODER_FIXTURE } from "../model/encoder-fixture";
import { bm25Scores, fusedScores, percentile, positions, summarize } from "../model/ranking";

describe("encoder ranking", () => {
  it("gives tied documents the worse position, so a tie never counts as a hit", () => {
    expect(positions([0.5, 0.9, 0.5])).toEqual([3, 1, 3]);
    expect(summarize([[0, 0, 0]], [1]).top1).toBe(0);
  });

  it("ranks the document that shares rare terms first under BM25 and keeps that through fusion", () => {
    const keyword = bm25Scores(["rainwater storage tanks"], ["soil and compost", "two rainwater storage tanks of 1,000 litres", "storage shed for tools"]);
    expect(positions(keyword[0] ?? [])[1]).toBe(1);
    expect(summarize(fusedScores(keyword, [[0.1, 0.8, 0.2]]), [1]).top1).toBe(1);
  });

  it("settles a fusion tie between swapped ranks by the tie-break score, and only then", () => {
    const keyword = [[0.9, 0.5, 0]];
    const encoder = [[0.4, 0.8, 0]];
    const fused = fusedScores(keyword, encoder);
    expect(fused[0]?.[0]).toBe(fused[0]?.[1]);
    expect(summarize(fused, [1]).top1).toBe(0);
    expect(summarize(fused, [1], encoder).top1).toBe(1);
    expect(summarize(fused, [0], encoder).positions).toEqual([2]);
  });

  it("uses the nearest-rank percentile", () => {
    expect(percentile([5, 1, 4, 2, 3], 50)).toBe(3);
    expect(percentile([...Array(20).keys()].map((i) => i + 1), 95)).toBe(19);
  });

  it("keeps the synthetic fixture at 40 requirements with exactly one satisfying section each", () => {
    expect(ENCODER_FIXTURE.synthetic).toBe(true);
    expect(ENCODER_FIXTURE.sections).toHaveLength(120);
    const targets = correctSectionIndexes();
    expect(targets).toHaveLength(40);
    expect(new Set(targets).size).toBe(40);
  });
});
